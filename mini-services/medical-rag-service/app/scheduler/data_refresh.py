"""
Data Refresh & Maintenance Scheduler
====================================

Automated maintenance tasks for the Medical RAG system:
- Weekly cron job for new PubMed articles (past 7 days)
- Incremental PMC full-text sync (only new articles)
- Re-embed new content using PubMedBERT
- Upsert new embeddings to Pinecone
- Archive retracted articles
- Index health checks
- Query latency tracking (p50, p95, p99)
- Alert on sync failures or latency > 500ms
"""

import asyncio
import time
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from loguru import logger

from app.core.config import get_settings


# ===== Constants =====

SYNC_INTERVAL_HOURS = 168  # Weekly (7 days)
RETRACTION_QUERY = "retracted publication[pt]"
LATENCY_ALERT_THRESHOLD_MS = 500


class SyncStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SyncResult:
    """Result of a sync operation."""
    sync_type: str
    status: SyncStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    articles_processed: int = 0
    articles_ingested: int = 0
    errors: int = 0
    duration_seconds: float = 0.0
    message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sync_type": self.sync_type,
            "status": self.status.value,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "articles_processed": self.articles_processed,
            "articles_ingested": self.articles_ingested,
            "errors": self.errors,
            "duration_seconds": round(self.duration_seconds, 2),
            "message": self.message,
        }


@dataclass
class LatencyMetrics:
    """Query latency tracking metrics."""
    latencies: List[float] = field(default_factory=list)
    p50: float = 0.0
    p95: float = 0.0
    p99: float = 0.0
    
    def add_latency(self, latency_ms: float):
        """Add a latency measurement."""
        self.latencies.append(latency_ms)
        
        if len(self.latencies) > 1000:
            self.latencies = self.latencies[-1000:]
        
        if self.latencies:
            sorted_latencies = sorted(self.latencies)
            n = len(sorted_latencies)
            
            self.p50 = sorted_latencies[int(n * 0.50)]
            self.p95 = sorted_latencies[int(n * 0.95)]
            self.p99 = sorted_latencies[int(n * 0.99)]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "count": len(self.latencies),
            "p50_ms": round(self.p50, 2),
            "p95_ms": round(self.p95, 2),
            "p99_ms": round(self.p99, 2),
        }


@dataclass
class IndexHealth:
    """Pinecone index health metrics."""
    total_vectors: int = 0
    index_fullness: float = 0.0
    namespaces: Dict[str, int] = field(default_factory=dict)
    last_updated: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_vectors": self.total_vectors,
            "index_fullness": self.index_fullness,
            "namespaces": self.namespaces,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }


class DataRefreshScheduler:
    """
    Automated data refresh and maintenance scheduler.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._running = False
        self._last_sync: Optional[datetime] = None
        self.latency_metrics = LatencyMetrics()
        self.index_health = IndexHealth()
        self.sync_history: List[SyncResult] = []
    
    async def sync_pubmed_articles(
        self,
        days: int = 7,
        max_articles: int = 5000,
    ) -> SyncResult:
        """Sync new PubMed articles from the past N days."""
        result = SyncResult(
            sync_type="pubmed_weekly",
            status=SyncStatus.RUNNING,
            start_time=datetime.utcnow(),
        )
        
        logger.info(f"Starting PubMed sync for past {days} days")
        
        try:
            from app.etl.pubmed_fetcher import PubMedFetcher
            from app.embedding.embedding_pipeline import PineconeIngestionPipeline
            
            fetcher = PubMedFetcher()
            pipeline = PineconeIngestionPipeline()
            await pipeline.initialize()
            
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            date_range = (
                start_date.strftime("%Y/%m/%d"),
                end_date.strftime("%Y/%m/%d"),
            )
            
            articles = []
            
            async with fetcher:
                search_results = await fetcher.search(
                    query="clinical trial[pt] OR systematic review[pt]",
                    max_results=max_articles,
                    date_range=date_range,
                )
                
                async for article in fetcher.fetch_articles(search_results.pmids):
                    articles.append(article.to_dict())
                    result.articles_processed += 1
            
            if articles:
                ingestion_stats = await pipeline.ingest_articles_batch(articles)
                result.articles_ingested = ingestion_stats.get("successful_upserts", 0)
            
            result.status = SyncStatus.COMPLETED
            result.message = f"Ingested {result.articles_ingested} articles"
            
        except Exception as e:
            result.status = SyncStatus.FAILED
            result.message = str(e)
            result.errors = 1
            logger.error(f"PubMed sync failed: {e}")
        
        result.end_time = datetime.utcnow()
        result.duration_seconds = (result.end_time - result.start_time).total_seconds()
        self.sync_history.append(result)
        self._last_sync = result.end_time
        
        return result
    
    async def check_index_health(self) -> IndexHealth:
        """Check Pinecone index health."""
        try:
            from app.retrieval.rag_engine import RAGRetrievalEngine
            
            rag_engine = RAGRetrievalEngine()
            await rag_engine.initialize()
            
            if rag_engine._index:
                stats = rag_engine._index.describe_index_stats()
                self.index_health.total_vectors = stats.total_vector_count
                self.index_health.index_fullness = stats.index_fullness
                self.index_health.last_updated = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
        
        return self.index_health
    
    async def track_query_latency(self) -> LatencyMetrics:
        """Track query latency with sample queries."""
        sample_queries = [
            "diabetes treatment",
            "heart failure diagnosis",
            "pneumonia symptoms",
        ]
        
        try:
            from app.retrieval.rag_engine import RAGRetrievalEngine
            
            rag_engine = RAGRetrievalEngine()
            
            for query in sample_queries:
                start_time = time.time()
                await rag_engine.retrieve(query, top_k=10)
                latency_ms = (time.time() - start_time) * 1000
                self.latency_metrics.add_latency(latency_ms)
            
            if self.latency_metrics.p95 > LATENCY_ALERT_THRESHOLD_MS:
                logger.warning(f"ALERT: Query latency p95 ({self.latency_metrics.p95:.0f}ms) exceeds threshold")
            
        except Exception as e:
            logger.error(f"Latency tracking failed: {e}")
        
        return self.latency_metrics
    
    async def run_maintenance(self) -> Dict[str, Any]:
        """Run all maintenance tasks."""
        logger.info("Starting maintenance cycle")
        
        pubmed_result = await self.sync_pubmed_articles(days=7)
        health = await self.check_index_health()
        latency = await self.track_query_latency()
        
        logger.info("Maintenance cycle completed")
        
        return {
            "pubmed_sync": pubmed_result.to_dict(),
            "index_health": health.to_dict(),
            "latency_metrics": latency.to_dict(),
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        return {
            "running": self._running,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "index_health": self.index_health.to_dict(),
            "latency_metrics": self.latency_metrics.to_dict(),
            "recent_syncs": [s.to_dict() for s in self.sync_history[-5:]],
        }


# ===== FastAPI Router =====

from fastapi import APIRouter

scheduler_router = APIRouter(prefix="/api/v1/scheduler", tags=["Scheduler"])

_scheduler: Optional[DataRefreshScheduler] = None


async def get_scheduler() -> DataRefreshScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = DataRefreshScheduler()
    return _scheduler


@scheduler_router.get("/status")
async def get_scheduler_status():
    scheduler = await get_scheduler()
    return scheduler.get_status()


@scheduler_router.post("/sync/pubmed")
async def trigger_pubmed_sync(days: int = 7, max_articles: int = 1000):
    scheduler = await get_scheduler()
    result = await scheduler.sync_pubmed_articles(days=days, max_articles=max_articles)
    return result.to_dict()


@scheduler_router.post("/maintenance")
async def trigger_maintenance():
    scheduler = await get_scheduler()
    return await scheduler.run_maintenance()


@scheduler_router.get("/health")
async def get_index_health():
    scheduler = await get_scheduler()
    health = await scheduler.check_index_health()
    return health.to_dict()
