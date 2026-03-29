"""
Re-embedding Pipeline for Pinecone Vector Database
==================================================

Handles migration and re-embedding of existing vectors when switching models.

Use Cases:
1. Migrating from all-mpnet-base-v2 to PubMedBERT
2. Re-embedding after model updates
3. Fixing corrupted embeddings
4. Updating metadata schema

Process:
1. Fetch existing vectors from Pinecone
2. Re-embed content with new model
3. Update vectors in Pinecone with new embeddings
4. Track migration progress
"""

import asyncio
import time
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

from loguru import logger

from app.core.config import get_settings
from app.embedding.pubmedbert_embeddings import (
    get_pubmedbert_service,
    PubMedBERTEmbeddingService,
)


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class MigrationStatus(Enum):
    """Status of migration process."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class MigrationProgress:
    """Progress tracking for migration."""
    status: MigrationStatus = MigrationStatus.PENDING
    total_vectors: int = 0
    processed_vectors: int = 0
    successful_updates: int = 0
    failed_updates: int = 0
    skipped_vectors: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    current_batch: int = 0
    total_batches: int = 0
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "total_vectors": self.total_vectors,
            "processed_vectors": self.processed_vectors,
            "successful_updates": self.successful_updates,
            "failed_updates": self.failed_updates,
            "skipped_vectors": self.skipped_vectors,
            "progress_percent": round(
                self.processed_vectors / max(self.total_vectors, 1) * 100, 2
            ),
            "current_batch": self.current_batch,
            "total_batches": self.total_batches,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": (
                (self.end_time - self.start_time).total_seconds()
                if self.start_time and self.end_time
                else (datetime.utcnow() - self.start_time).total_seconds()
                if self.start_time else 0
            ),
            "errors": self.errors[:10],  # Limit error list
        }


@dataclass
class VectorData:
    """Data for a vector to be re-embedded."""
    id: str
    text_content: str
    metadata: Dict[str, Any]

    @classmethod
    def from_pinecone_result(cls, result: Dict[str, Any]) -> "VectorData":
        """Create from Pinecone query result."""
        metadata = result.get("metadata", {})
        
        # Reconstruct text from metadata
        title = metadata.get("title", "")
        abstract = metadata.get("abstract", "")
        text_content = f"{title}\n\n{abstract}"
        
        return cls(
            id=result.get("id", ""),
            text_content=text_content,
            metadata=metadata,
        )


# =============================================================================
# RE-EMBEDDING PIPELINE
# =============================================================================

class ReembeddingPipeline:
    """
    Pipeline for re-embedding vectors in Pinecone.
    
    Features:
    - Batch processing for efficiency
    - Progress tracking
    - Error recovery
    - Pause/resume capability
    - Validation before update
    
    Usage:
        pipeline = ReembeddingPipeline()
        
        # Start migration
        progress = await pipeline.migrate_all(batch_size=100)
        
        # Check status
        status = pipeline.get_progress()
        
        # Pause/resume
        pipeline.pause()
        pipeline.resume()
    """

    BATCH_SIZE = 100
    MAX_ERRORS_BEFORE_STOP = 10

    def __init__(
        self,
        batch_size: int = BATCH_SIZE,
        dry_run: bool = False,
    ):
        self.settings = get_settings()
        self.batch_size = batch_size
        self.dry_run = dry_run
        
        self._pinecone = None
        self._index = None
        self._embedding_service: Optional[PubMedBERTEmbeddingService] = None
        
        self._progress = MigrationProgress()
        self._paused = False
        self._cancelled = False

    async def initialize(self):
        """Initialize Pinecone connection and embedding service."""
        try:
            from pinecone import Pinecone
            
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            
            logger.info(f"[Reembedding] Connected to Pinecone index: {self.settings.PINECONE_INDEX_NAME}")
            
        except Exception as e:
            logger.error(f"[Reembedding] Failed to connect to Pinecone: {e}")
            raise
        
        # Initialize embedding service
        self._embedding_service = await get_pubmedbert_service()
        logger.info(f"[Reembedding] Embedding service initialized: {self._embedding_service.model_name}")

    async def get_vector_count(self) -> int:
        """Get total vector count in the index."""
        if self._index is None:
            await self.initialize()
        
        try:
            stats = self._index.describe_index_stats()
            namespace_stats = stats.namespaces.get(self.settings.PINECONE_NAMESPACE)
            return namespace_stats.vector_count if namespace_stats else 0
        except Exception as e:
            logger.error(f"[Reembedding] Failed to get vector count: {e}")
            return 0

    async def fetch_vectors_batch(
        self,
        prefix: str = "",
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Fetch a batch of vectors from Pinecone.
        
        Note: Pinecone doesn't support direct vector listing, so we use
        a workaround by querying with a zero vector to get results.
        """
        if self._index is None:
            await self.initialize()
        
        try:
            # Use a zero vector query to fetch vectors
            zero_vector = [0.0] * self.settings.EMBEDDING_DIMENSION
            
            response = self._index.query(
                vector=zero_vector,
                top_k=limit,
                namespace=self.settings.PINECONE_NAMESPACE,
                include_metadata=True,
                include_values=False,
            )
            
            results = []
            for match in response.matches:
                results.append({
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata or {},
                })
            
            return results
            
        except Exception as e:
            logger.error(f"[Reembedding] Failed to fetch vectors: {e}")
            return []

    async def reembed_and_update(
        self,
        vectors: List[VectorData],
    ) -> Tuple[int, int, List[str]]:
        """
        Re-embed a batch of vectors and update in Pinecone.
        
        Returns:
            Tuple of (successful, failed, errors)
        """
        if self._embedding_service is None:
            await self.initialize()
        
        successful = 0
        failed = 0
        errors = []
        
        # Filter vectors with content
        valid_vectors = [v for v in vectors if v.text_content.strip()]
        
        if not valid_vectors:
            return 0, 0, ["No valid text content found"]
        
        try:
            # Generate new embeddings
            texts = [v.text_content for v in valid_vectors]
            embedding_results = await self._embedding_service.embed_batch(texts)
            
            # Prepare vectors for update
            update_vectors = []
            for vector, result in zip(valid_vectors, embedding_results):
                if result and result.embedding:
                    update_vectors.append((
                        vector.id,
                        result.embedding,
                        vector.metadata,
                    ))
                else:
                    failed += 1
                    errors.append(f"Failed to embed vector: {vector.id}")
            
            if self.dry_run:
                logger.info(f"[Reembedding] DRY RUN: Would update {len(update_vectors)} vectors")
                successful = len(update_vectors)
            else:
                # Update vectors in Pinecone
                if update_vectors:
                    try:
                        self._index.upsert(
                            vectors=update_vectors,
                            namespace=self.settings.PINECONE_NAMESPACE,
                        )
                        successful = len(update_vectors)
                    except Exception as e:
                        failed += len(update_vectors)
                        errors.append(f"Pinecone upsert failed: {e}")
            
        except Exception as e:
            failed = len(vectors)
            errors.append(f"Batch processing failed: {e}")
        
        return successful, failed, errors

    async def migrate_all(
        self,
        batch_size: Optional[int] = None,
    ) -> MigrationProgress:
        """
        Run full migration of all vectors.
        
        Args:
            batch_size: Override default batch size
            
        Returns:
            MigrationProgress with final status
        """
        if self._index is None:
            await self.initialize()
        
        batch_size = batch_size or self.batch_size
        
        # Initialize progress
        self._progress = MigrationProgress(
            status=MigrationStatus.IN_PROGRESS,
            start_time=datetime.utcnow(),
        )
        
        # Get total vector count
        self._progress.total_vectors = await self.get_vector_count()
        
        if self._progress.total_vectors == 0:
            logger.warning("[Reembedding] No vectors found in index")
            self._progress.status = MigrationStatus.COMPLETED
            self._progress.end_time = datetime.utcnow()
            return self._progress
        
        logger.info(
            f"[Reembedding] Starting migration of {self._progress.total_vectors} vectors "
            f"with batch size {batch_size}"
        )
        
        # Process in batches
        processed_ids = set()
        consecutive_empty_batches = 0
        max_empty_batches = 3
        
        while (
            self._progress.processed_vectors < self._progress.total_vectors
            and not self._cancelled
            and consecutive_empty_batches < max_empty_batches
        ):
            # Check for pause
            while self._paused:
                await asyncio.sleep(1)
                if self._cancelled:
                    break
            
            if self._cancelled:
                self._progress.status = MigrationStatus.PAUSED
                break
            
            # Fetch batch
            self._progress.current_batch += 1
            raw_vectors = await self.fetch_vectors_batch(limit=batch_size)
            
            # Filter out already processed
            new_vectors = [
                VectorData.from_pinecone_result(v)
                for v in raw_vectors
                if v.get("id") not in processed_ids
            ]
            
            if not new_vectors:
                consecutive_empty_batches += 1
                logger.warning(
                    f"[Reembedding] Empty batch {consecutive_empty_batches}/{max_empty_batches}"
                )
                continue
            
            consecutive_empty_batches = 0
            
            # Process batch
            successful, failed, errors = await self.reembed_and_update(new_vectors)
            
            # Update progress
            self._progress.processed_vectors += len(new_vectors)
            self._progress.successful_updates += successful
            self._progress.failed_updates += failed
            self._progress.errors.extend(errors)
            
            # Track processed IDs
            for v in new_vectors:
                processed_ids.add(v.id)
            
            logger.info(
                f"[Reembedding] Batch {self._progress.current_batch}: "
                f"{successful} successful, {failed} failed, "
                f"{self._progress.processed_vectors}/{self._progress.total_vectors} total"
            )
            
            # Check for too many errors
            if len(self._progress.errors) >= self.MAX_ERRORS_BEFORE_STOP:
                logger.error("[Reembedding] Too many errors, stopping migration")
                self._progress.status = MigrationStatus.FAILED
                self._progress.end_time = datetime.utcnow()
                return self._progress
        
        # Mark complete
        if not self._cancelled:
            self._progress.status = MigrationStatus.COMPLETED
        self._progress.end_time = datetime.utcnow()
        
        logger.info(
            f"[Reembedding] Migration completed: "
            f"{self._progress.successful_updates} successful, "
            f"{self._progress.failed_updates} failed"
        )
        
        return self._progress

    def pause(self):
        """Pause the migration."""
        self._paused = True
        logger.info("[Reembedding] Migration paused")

    def resume(self):
        """Resume the migration."""
        self._paused = False
        logger.info("[Reembedding] Migration resumed")

    def cancel(self):
        """Cancel the migration."""
        self._cancelled = True
        self._paused = False
        logger.info("[Reembedding] Migration cancelled")

    def get_progress(self) -> MigrationProgress:
        """Get current migration progress."""
        return self._progress


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def run_reembedding(
    batch_size: int = 100,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Run re-embedding migration.
    
    Args:
        batch_size: Number of vectors per batch
        dry_run: If True, don't actually update vectors
        
    Returns:
        Migration progress dictionary
    """
    pipeline = ReembeddingPipeline(batch_size=batch_size, dry_run=dry_run)
    progress = await pipeline.migrate_all()
    return progress.to_dict()


async def estimate_migration_time(
    vectors_per_second: float = 10,
) -> Dict[str, Any]:
    """
    Estimate migration time based on vector count.
    
    Args:
        vectors_per_second: Estimated processing speed
        
    Returns:
        Estimation dictionary
    """
    pipeline = ReembeddingPipeline()
    total_vectors = await pipeline.get_vector_count()
    
    estimated_seconds = total_vectors / vectors_per_second
    estimated_minutes = estimated_seconds / 60
    
    return {
        "total_vectors": total_vectors,
        "estimated_seconds": round(estimated_seconds, 2),
        "estimated_minutes": round(estimated_minutes, 2),
        "vectors_per_second": vectors_per_second,
    }
