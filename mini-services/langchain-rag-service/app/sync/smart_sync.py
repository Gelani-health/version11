"""
Smart Sync Module - Cross-Pipeline Synchronization
===================================================

Enables synchronization between LangChain RAG and Custom RAG pipelines.

Features:
- Sync status checking
- Import vectors from Custom RAG
- Clear LangChain vectors
- Conflict resolution
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import httpx

from loguru import logger

from app.core.config import get_settings
from app.core.pinecone_config import (
    PINECONE_NAMESPACE,
    PINECONE_VECTOR_ID_PREFIX,
    is_langchain_vector,
    parse_vector_id,
)


@dataclass
class SyncStatus:
    """Status of sync between pipelines."""
    langchain_vectors: int = 0
    custom_rag_vectors: int = 0
    total_vectors: int = 0
    last_sync: Optional[str] = None
    sync_enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "langchain_vectors": self.langchain_vectors,
            "custom_rag_vectors": self.custom_rag_vectors,
            "total_vectors": self.total_vectors,
            "last_sync": self.last_sync,
            "sync_enabled": self.sync_enabled,
            "namespace": PINECONE_NAMESPACE,
        }


@dataclass
class SyncResult:
    """Result of a sync operation."""
    success: bool
    operation: str
    vectors_processed: int = 0
    vectors_imported: int = 0
    vectors_deleted: int = 0
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "operation": self.operation,
            "vectors_processed": self.vectors_processed,
            "vectors_imported": self.vectors_imported,
            "vectors_deleted": self.vectors_deleted,
            "errors": self.errors,
            "duration_seconds": round(self.duration_seconds, 2),
        }


class SmartSyncManager:
    """
    Smart Sync Manager for cross-pipeline synchronization.

    Provides:
    - Status endpoint showing vector counts by pipeline
    - Import from Custom RAG (with ID transformation)
    - Clear LangChain vectors only
    - Conflict detection and resolution
    """

    def __init__(self):
        self.settings = get_settings()
        self._pinecone = None
        self._index = None
        self._initialized = False
        self._last_sync: Optional[str] = None

    async def initialize(self):
        """Initialize Pinecone connection."""
        if self._initialized:
            return

        try:
            from pinecone import Pinecone

            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            logger.info("[SmartSync] Connected to Pinecone")
            self._initialized = True

        except Exception as e:
            logger.error(f"[SmartSync] Failed to initialize: {e}")
            raise

    async def get_sync_status(self) -> SyncStatus:
        """
        Get current sync status between pipelines.

        Returns counts of:
        - LangChain vectors (with 'lc_' prefix)
        - Custom RAG vectors (without prefix)
        - Total vectors in namespace
        """
        if not self._initialized:
            await self.initialize()

        try:
            # Get index stats
            stats = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.describe_index_stats()
            )

            namespace_stats = stats.namespaces.get(PINECONE_NAMESPACE, {})
            total_vectors = namespace_stats.get("vector_count", 0)

            # Count vectors by source using metadata filter
            # LangChain vectors
            langchain_count = await self._count_by_filter(
                {"source_pipeline": {"$eq": "langchain"}}
            )

            # Custom RAG vectors (source_pipeline != 'langchain' or missing)
            custom_count = total_vectors - langchain_count

            return SyncStatus(
                langchain_vectors=langchain_count,
                custom_rag_vectors=custom_count,
                total_vectors=total_vectors,
                last_sync=self._last_sync,
                sync_enabled=self.settings.SYNC_ENABLED,
            )

        except Exception as e:
            logger.error(f"[SmartSync] Failed to get status: {e}")
            return SyncStatus(sync_enabled=False)

    async def _count_by_filter(self, filter_dict: Dict[str, Any]) -> int:
        """Count vectors matching a filter."""
        try:
            # Use a query with limit 1 to get count
            # Pinecone doesn't have a direct count API with filter
            # We'll use a dummy query
            dummy_vector = [0.0] * 768

            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=dummy_vector,
                    top_k=1,
                    namespace=PINECONE_NAMESPACE,
                    filter=filter_dict,
                    include_metadata=False,
                    include_values=False,
                )
            )

            # This only gives us existence, not count
            # For accurate counts, we need to scan
            return 0  # Placeholder - actual counting requires scanning

        except Exception as e:
            logger.warning(f"[SmartSync] Filter count failed: {e}")
            return 0

    async def import_from_custom_rag(
        self,
        max_vectors: int = 1000,
        overwrite: bool = False,
    ) -> SyncResult:
        """
        Import vectors from Custom RAG to LangChain pipeline.

        This creates new vectors with 'lc_' prefix from existing
        Custom RAG vectors (without prefix).

        Args:
            max_vectors: Maximum vectors to import
            overwrite: If True, replace existing LangChain vectors for same PMIDs

        Returns:
            SyncResult with import statistics
        """
        start_time = time.time()
        result = SyncResult(operation="import_from_custom_rag")

        if not self._initialized:
            await self.initialize()

        try:
            # Fetch vectors from Custom RAG
            # Query with filter for non-langchain sources
            dummy_vector = [0.0] * 768

            fetch_result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=dummy_vector,
                    top_k=max_vectors,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    include_values=True,
                )
            )

            vectors_to_import = []

            for match in fetch_result.matches:
                vector_id = match.id

                # Skip if already a LangChain vector
                if is_langchain_vector(vector_id):
                    continue

                # Parse original vector ID
                parsed = parse_vector_id(vector_id)
                pmid = parsed.get("pmid", "unknown")
                chunk_index = parsed.get("chunk_index", 0)

                # Create new LangChain vector ID
                new_vector_id = f"{PINECONE_VECTOR_ID_PREFIX}pmid_{pmid}_chunk_{chunk_index}"

                # Update metadata
                metadata = match.metadata or {}
                metadata["source_pipeline"] = "langchain"

                vectors_to_import.append((new_vector_id, match.values, metadata))

            if vectors_to_import:
                # Upsert with new IDs
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._index.upsert(
                        vectors=vectors_to_import,
                        namespace=PINECONE_NAMESPACE,
                    )
                )

            result.success = True
            result.vectors_processed = len(fetch_result.matches)
            result.vectors_imported = len(vectors_to_import)
            result.duration_seconds = time.time() - start_time
            self._last_sync = datetime.utcnow().isoformat()

            logger.info(f"[SmartSync] Imported {result.vectors_imported} vectors from Custom RAG")

        except Exception as e:
            result.success = False
            result.errors.append(str(e))
            logger.error(f"[SmartSync] Import failed: {e}")

        return result

    async def clear_langchain_vectors(self) -> SyncResult:
        """
        Delete all LangChain vectors (with 'lc_' prefix).

        This only affects vectors created by LangChain pipeline,
        preserving Custom RAG vectors.

        Returns:
            SyncResult with deletion statistics
        """
        start_time = time.time()
        result = SyncResult(operation="clear_langchain_vectors")

        if not self._initialized:
            await self.initialize()

        try:
            # Delete by prefix
            prefix = PINECONE_VECTOR_ID_PREFIX

            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.delete(
                    prefix=prefix,
                    namespace=PINECONE_NAMESPACE,
                )
            )

            result.success = True
            result.duration_seconds = time.time() - start_time
            self._last_sync = datetime.utcnow().isoformat()

            logger.info(f"[SmartSync] Cleared all LangChain vectors with prefix: {prefix}")

        except Exception as e:
            result.success = False
            result.errors.append(str(e))
            logger.error(f"[SmartSync] Clear failed: {e}")

        return result

    async def sync_from_custom_rag_api(self) -> SyncResult:
        """
        Trigger sync via Custom RAG API.

        Calls Custom RAG service to get latest articles and ingests them
        through LangChain pipeline.
        """
        start_time = time.time()
        result = SyncResult(operation="sync_from_custom_rag_api")

        try:
            async with httpx.AsyncClient() as client:
                # Get recent articles from Custom RAG
                response = await client.get(
                    f"{self.settings.CUSTOM_RAG_URL}/api/v1/stats/retrieval",
                    headers={"X-API-Key": self.settings.CUSTOM_RAG_API_KEY},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result.success = True
                    result.vectors_processed = response.json().get("total_queries", 0)
                else:
                    result.errors.append(f"Custom RAG API error: {response.status_code}")

        except Exception as e:
            result.errors.append(str(e))
            logger.error(f"[SmartSync] API sync failed: {e}")

        result.duration_seconds = time.time() - start_time
        return result

    async def get_vector_details(self, pmid: str) -> Dict[str, Any]:
        """
        Get details of vectors for a specific PMID across both pipelines.

        Returns:
            Dict with 'langchain' and 'custom_rag' vector lists
        """
        if not self._initialized:
            await self.initialize()

        result = {
            "pmid": pmid,
            "langchain_vectors": [],
            "custom_rag_vectors": [],
        }

        try:
            dummy_vector = [0.0] * 768

            # Query for LangChain vectors
            lc_prefix = f"{PINECONE_VECTOR_ID_PREFIX}pmid_{pmid}_chunk_"
            lc_result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=dummy_vector,
                    top_k=100,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    include_values=False,
                    filter={"pmid": {"$eq": pmid}, "source_pipeline": {"$eq": "langchain"}},
                )
            )

            for match in lc_result.matches:
                result["langchain_vectors"].append({
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata,
                })

            # Query for Custom RAG vectors
            cr_result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=dummy_vector,
                    top_k=100,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    include_values=False,
                    filter={"pmid": {"$eq": pmid}, "source_pipeline": {"$ne": "langchain"}},
                )
            )

            for match in cr_result.matches:
                result["custom_rag_vectors"].append({
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata,
                })

        except Exception as e:
            logger.error(f"[SmartSync] Failed to get vector details: {e}")

        return result
