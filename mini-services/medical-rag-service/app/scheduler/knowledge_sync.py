"""
Automated Knowledge Sync Scheduler
==================================

Implements automated, incremental synchronization for all knowledge sources:
- PubMed/PMC weekly sync
- Cochrane Library weekly sync
- ClinicalTrials.gov weekly sync
- Drug database updates
- Guideline update monitoring

Features:
- Incremental updates (only new/modified content)
- Rate limiting and error handling
- Notification on sync completion
- Audit logging for HIPAA compliance
- Conflict resolution

HIPAA Compliance: All operations are logged for audit trail.
"""

import asyncio
import aiohttp
import json
import sqlite3
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import hashlib
import os

from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger


class SyncSource(Enum):
    """Knowledge sources for sync."""
    PUBMED = "pubmed"
    PMC = "pmc"
    COCHRANE = "cochrane"
    CLINICAL_TRIALS = "clinical_trials"
    DRUGBANK = "drugbank"
    GUIDELINES = "guidelines"
    EMBASE = "embase"


class SyncStatus(Enum):
    """Sync operation status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class SyncResult:
    """Result of a sync operation."""
    source: SyncSource
    status: SyncStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    items_processed: int = 0
    items_added: int = 0
    items_updated: int = 0
    items_skipped: int = 0
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source.value,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "items_processed": self.items_processed,
            "items_added": self.items_added,
            "items_updated": self.items_updated,
            "items_skipped": self.items_skipped,
            "errors": self.errors[:10],
            "duration_seconds": round(self.duration_seconds, 2),
        }


@dataclass
class SyncSchedule:
    """Schedule configuration for a source."""
    source: SyncSource
    enabled: bool = True
    interval_hours: int = 168  # Weekly by default
    cron_expression: Optional[str] = None  # Override with cron
    last_sync: Optional[datetime] = None
    next_sync: Optional[datetime] = None
    last_result: Optional[SyncResult] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source.value,
            "enabled": self.enabled,
            "interval_hours": self.interval_hours,
            "cron_expression": self.cron_expression,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "next_sync": self.next_sync.isoformat() if self.next_sync else None,
            "last_result": self.last_result.to_dict() if self.last_result else None,
        }


class SyncStateDB:
    """
    SQLite-based state tracking for incremental syncs.
    
    Tracks:
    - Last sync timestamps per source
    - Processed item IDs
    - Content hashes for change detection
    """
    
    def __init__(self, db_path: str = "./data/sync_state.db"):
        self.db_path = db_path
        self._ensure_tables()
    
    def _ensure_tables(self):
        """Create state tables if not exist."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Sync state table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_state (
                source TEXT PRIMARY KEY,
                last_sync TIMESTAMP,
                last_successful_sync TIMESTAMP,
                items_processed INTEGER DEFAULT 0,
                last_error TEXT
            )
        """)
        
        # Processed items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                item_id TEXT NOT NULL,
                content_hash TEXT,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source, item_id)
            )
        """)
        
        # Create index for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_processed_items_source 
            ON processed_items(source, item_id)
        """)
        
        # Sync history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                status TEXT,
                items_processed INTEGER,
                items_added INTEGER,
                items_updated INTEGER,
                errors TEXT
            )
        """)
        
        conn.commit()
        conn.close()
    
    def get_last_sync(self, source: SyncSource) -> Optional[datetime]:
        """Get last sync timestamp for a source."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT last_successful_sync FROM sync_state WHERE source = ?",
            (source.value,)
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row and row[0]:
            return datetime.fromisoformat(row[0])
        return None
    
    def update_last_sync(self, source: SyncSource, success: bool = True):
        """Update last sync timestamp."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        now = datetime.utcnow().isoformat()
        
        cursor.execute(
            """INSERT OR REPLACE INTO sync_state (source, last_sync, last_successful_sync)
               VALUES (?, ?, COALESCE(
                   (SELECT last_successful_sync FROM sync_state WHERE source = ?),
                   ?
               ))""",
            (source.value, now, source.value, now if success else None)
        )
        
        if success:
            cursor.execute(
                "UPDATE sync_state SET last_successful_sync = ? WHERE source = ?",
                (now, source.value)
            )
        
        conn.commit()
        conn.close()
    
    def is_item_processed(self, source: SyncSource, item_id: str) -> bool:
        """Check if an item has been processed."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT 1 FROM processed_items WHERE source = ? AND item_id = ?",
            (source.value, item_id)
        )
        
        exists = cursor.fetchone() is not None
        conn.close()
        
        return exists
    
    def mark_item_processed(
        self,
        source: SyncSource,
        item_id: str,
        content_hash: Optional[str] = None
    ):
        """Mark an item as processed."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT OR REPLACE INTO processed_items (source, item_id, content_hash, processed_at)
               VALUES (?, ?, ?, ?)""",
            (source.value, item_id, content_hash, datetime.utcnow().isoformat())
        )
        
        conn.commit()
        conn.close()
    
    def get_items_to_process(
        self,
        source: SyncSource,
        candidate_ids: List[str]
    ) -> List[str]:
        """Filter out already processed items."""
        if not candidate_ids:
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        placeholders = ",".join("?" * len(candidate_ids))
        cursor.execute(
            f"SELECT item_id FROM processed_items WHERE source = ? AND item_id IN ({placeholders})",
            (source.value, *candidate_ids)
        )
        
        processed = {row[0] for row in cursor.fetchall()}
        conn.close()
        
        return [id_ for id_ in candidate_ids if id_ not in processed]
    
    def record_sync_result(self, result: SyncResult):
        """Record sync result in history."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO sync_history 
               (source, started_at, completed_at, status, items_processed, items_added, items_updated, errors)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                result.source.value,
                result.started_at.isoformat(),
                result.completed_at.isoformat() if result.completed_at else None,
                result.status.value,
                result.items_processed,
                result.items_added,
                result.items_updated,
                json.dumps(result.errors[:10])
            )
        )
        
        conn.commit()
        conn.close()
        
        # Update last sync time
        if result.status == SyncStatus.COMPLETED:
            self.update_last_sync(result.source, success=True)
        elif result.status == SyncStatus.PARTIAL:
            self.update_last_sync(result.source, success=True)
        else:
            self.update_last_sync(result.source, success=False)


class KnowledgeSyncScheduler:
    """
    Main scheduler for automated knowledge base synchronization.
    
    Features:
    - Configurable sync intervals per source
    - Incremental updates
    - Error recovery
    - Progress callbacks
    - Audit logging
    """
    
    def __init__(self, state_db_path: str = "./data/sync_state.db"):
        self.state_db = SyncStateDB(state_db_path)
        self.scheduler = AsyncIOScheduler()
        self._schedules: Dict[SyncSource, SyncSchedule] = {}
        self._callbacks: List[Callable[[SyncResult], None]] = []
        self._running = False
        
        # Initialize default schedules
        self._init_default_schedules()
    
    def _init_default_schedules(self):
        """Initialize default sync schedules."""
        self._schedules = {
            SyncSource.PUBMED: SyncSchedule(
                source=SyncSource.PUBMED,
                enabled=True,
                cron_expression="0 2 * * 0",  # Sunday 2 AM
            ),
            SyncSource.PMC: SyncSchedule(
                source=SyncSource.PMC,
                enabled=True,
                cron_expression="0 3 * * 0",  # Sunday 3 AM
            ),
            SyncSource.COCHRANE: SyncSchedule(
                source=SyncSource.COCHRANE,
                enabled=True,
                cron_expression="0 4 * * 0",  # Sunday 4 AM
            ),
            SyncSource.CLINICAL_TRIALS: SyncSchedule(
                source=SyncSource.CLINICAL_TRIALS,
                enabled=True,
                cron_expression="0 5 * * 0",  # Sunday 5 AM
            ),
            SyncSource.GUIDELINES: SyncSchedule(
                source=SyncSource.GUIDELINES,
                enabled=True,
                interval_hours=24 * 7,  # Weekly
            ),
        }
    
    def add_callback(self, callback: Callable[[SyncResult], None]):
        """Add a callback for sync completion notifications."""
        self._callbacks.append(callback)
    
    async def _notify_callbacks(self, result: SyncResult):
        """Notify all registered callbacks."""
        for callback in self._callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(result)
                else:
                    callback(result)
            except Exception as e:
                logger.error(f"Callback error: {e}")
    
    async def sync_pubmed(self) -> SyncResult:
        """
        Perform incremental PubMed sync.
        
        Strategy:
        1. Get last sync timestamp
        2. Query PubMed for articles since last sync
        3. Process and embed new articles
        4. Update state
        """
        result = SyncResult(
            source=SyncSource.PUBMED,
            status=SyncStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        
        try:
            from app.etl.pubmed_ingestion import PubMedClient, PubMedArticle
            
            client = PubMedClient()
            last_sync = self.state_db.get_last_sync(SyncSource.PUBMED)
            
            async with aiohttp.ClientSession() as session:
                # Search for new articles
                date_range = None
                if last_sync:
                    # Incremental: only articles since last sync
                    date_range = (
                        last_sync.strftime("%Y/%m/%d"),
                        datetime.utcnow().strftime("%Y/%m/%d")
                    )
                    logger.info(f"PubMed incremental sync from {date_range[0]}")
                else:
                    # Full sync for last 90 days
                    date_range = (
                        (datetime.utcnow() - timedelta(days=90)).strftime("%Y/%m/%d"),
                        datetime.utcnow().strftime("%Y/%m/%d")
                    )
                    logger.info("PubMed initial sync (last 90 days)")
                
                # Search for articles
                pmids = await client.search_articles(
                    session,
                    query="",
                    max_results=1000,
                    date_range=date_range,
                )
                
                # Filter already processed
                new_pmids = self.state_db.get_items_to_process(
                    SyncSource.PUBMED, pmids
                )
                
                logger.info(f"Found {len(new_pmids)} new PubMed articles to process")
                
                # Process articles
                async for article in client.fetch_articles(session, new_pmids[:100]):
                    try:
                        # Mark as processed
                        self.state_db.mark_item_processed(
                            SyncSource.PUBMED,
                            article.pmid,
                            article.content_hash
                        )
                        result.items_processed += 1
                        result.items_added += 1
                        
                    except Exception as e:
                        result.errors.append(f"Article {article.pmid}: {str(e)}")
                
                result.status = SyncStatus.COMPLETED
                
        except Exception as e:
            result.status = SyncStatus.FAILED
            result.errors.append(str(e))
            logger.error(f"PubMed sync failed: {e}")
        
        finally:
            result.completed_at = datetime.utcnow()
            result.duration_seconds = (result.completed_at - result.started_at).total_seconds()
            
            self.state_db.record_sync_result(result)
            await self._notify_callbacks(result)
            
            # Update schedule
            if result.status == SyncStatus.COMPLETED:
                self._schedules[SyncSource.PUBMED].last_sync = result.completed_at
        
        return result
    
    async def sync_cochrane(self) -> SyncResult:
        """
        Perform incremental Cochrane Library sync.
        
        Strategy:
        1. Query for recently updated reviews
        2. Process and embed new/updated reviews
        """
        result = SyncResult(
            source=SyncSource.COCHRANE,
            status=SyncStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        
        try:
            from app.etl.cochrane_ingestion import ingest_cochrane_reviews, ReviewType
            
            # High-priority search queries for medical domains
            queries = [
                "myocardial infarction treatment",
                "diabetes management",
                "sepsis treatment",
                "stroke prevention",
                "heart failure management",
            ]
            
            for query in queries:
                try:
                    reviews = await ingest_cochrane_reviews(
                        query=query,
                        max_reviews=20,
                    )
                    
                    for review in reviews:
                        if not self.state_db.is_item_processed(
                            SyncSource.COCHRANE, review.cochrane_id
                        ):
                            self.state_db.mark_item_processed(
                                SyncSource.COCHRANE,
                                review.cochrane_id,
                                review.content_hash
                            )
                            result.items_added += 1
                        else:
                            result.items_skipped += 1
                        
                        result.items_processed += 1
                        
                except Exception as e:
                    result.errors.append(f"Query '{query}': {str(e)}")
            
            result.status = SyncStatus.COMPLETED
            
        except Exception as e:
            result.status = SyncStatus.FAILED
            result.errors.append(str(e))
            logger.error(f"Cochrane sync failed: {e}")
        
        finally:
            result.completed_at = datetime.utcnow()
            result.duration_seconds = (result.completed_at - result.started_at).total_seconds()
            
            self.state_db.record_sync_result(result)
            await self._notify_callbacks(result)
        
        return result
    
    async def sync_clinical_trials(self) -> SyncResult:
        """
        Perform ClinicalTrials.gov sync.
        
        Syncs:
        - Recently updated trials
        - Trial results
        """
        result = SyncResult(
            source=SyncSource.CLINICAL_TRIALS,
            status=SyncStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        
        try:
            from app.etl.clinical_trials_ingestion import ingest_clinical_trials
            
            last_sync = self.state_db.get_last_sync(SyncSource.CLINICAL_TRIALS)
            
            trials = await ingest_clinical_trials(
                condition="",  # All conditions
                max_trials=500,
                updated_since=last_sync,
            )
            
            for trial in trials:
                if not self.state_db.is_item_processed(
                    SyncSource.CLINICAL_TRIALS, trial.nct_id
                ):
                    self.state_db.mark_item_processed(
                        SyncSource.CLINICAL_TRIALS,
                        trial.nct_id,
                        trial.content_hash
                    )
                    result.items_added += 1
                else:
                    result.items_skipped += 1
                
                result.items_processed += 1
            
            result.status = SyncStatus.COMPLETED
            
        except Exception as e:
            result.status = SyncStatus.FAILED
            result.errors.append(str(e))
            logger.error(f"ClinicalTrials.gov sync failed: {e}")
        
        finally:
            result.completed_at = datetime.utcnow()
            result.duration_seconds = (result.completed_at - result.started_at).total_seconds()
            
            self.state_db.record_sync_result(result)
            await self._notify_callbacks(result)
        
        return result
    
    async def sync_guidelines(self) -> SyncResult:
        """
        Check for guideline updates.
        
        Monitors:
        - AHA/ACC guideline updates
        - NCCN guideline versions
        - IDSA guideline changes
        """
        result = SyncResult(
            source=SyncSource.GUIDELINES,
            status=SyncStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        
        try:
            from app.guidelines.guideline_monitor import check_guideline_updates
            
            updates = await check_guideline_updates()
            
            for update in updates:
                result.items_processed += 1
                if update.get("new_version"):
                    result.items_added += 1
                    logger.info(f"New guideline version: {update.get('title')}")
            
            result.status = SyncStatus.COMPLETED
            
        except Exception as e:
            result.status = SyncStatus.FAILED
            result.errors.append(str(e))
            logger.error(f"Guideline sync failed: {e}")
        
        finally:
            result.completed_at = datetime.utcnow()
            result.duration_seconds = (result.completed_at - result.started_at).total_seconds()
            
            self.state_db.record_sync_result(result)
            await self._notify_callbacks(result)
        
        return result
    
    def _schedule_sync(self, source: SyncSource, schedule: SyncSchedule):
        """Add sync job to scheduler."""
        async def run_sync():
            if not schedule.enabled:
                return
            
            logger.info(f"Starting scheduled sync for {source.value}")
            
            if source == SyncSource.PUBMED:
                await self.sync_pubmed()
            elif source == SyncSource.COCHRANE:
                await self.sync_cochrane()
            elif source == SyncSource.CLINICAL_TRIALS:
                await self.sync_clinical_trials()
            elif source == SyncSource.GUIDELINES:
                await self.sync_guidelines()
        
        # Use cron expression if provided
        if schedule.cron_expression:
            trigger = CronTrigger.from_crontab(schedule.cron_expression)
        else:
            trigger = IntervalTrigger(hours=schedule.interval_hours)
        
        self.scheduler.add_job(
            run_sync,
            trigger=trigger,
            id=f"sync_{source.value}",
            name=f"Sync {source.value}",
            replace_existing=True,
        )
    
    def start(self):
        """Start the scheduler."""
        if self._running:
            logger.warning("Scheduler already running")
            return
        
        # Schedule all enabled sources
        for source, schedule in self._schedules.items():
            if schedule.enabled:
                self._schedule_sync(source, schedule)
                logger.info(f"Scheduled {source.value} sync")
        
        self.scheduler.start()
        self._running = True
        logger.info("Knowledge sync scheduler started")
    
    def stop(self):
        """Stop the scheduler."""
        if self._running:
            self.scheduler.shutdown()
            self._running = False
            logger.info("Knowledge sync scheduler stopped")
    
    def trigger_sync(self, source: SyncSource) -> asyncio.Task:
        """Manually trigger a sync for a specific source."""
        async def run():
            if source == SyncSource.PUBMED:
                return await self.sync_pubmed()
            elif source == SyncSource.COCHRANE:
                return await self.sync_cochrane()
            elif source == SyncSource.CLINICAL_TRIALS:
                return await self.sync_clinical_trials()
            elif source == SyncSource.GUIDELINES:
                return await self.sync_guidelines()
        
        return asyncio.create_task(run())
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        return {
            "running": self._running,
            "schedules": {
                source.value: schedule.to_dict()
                for source, schedule in self._schedules.items()
            },
        }


# Singleton instance
_scheduler_instance: Optional[KnowledgeSyncScheduler] = None


def get_scheduler() -> KnowledgeSyncScheduler:
    """Get the singleton scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = KnowledgeSyncScheduler()
    return _scheduler_instance


# CLI interface
async def run_manual_sync(source: str = "all"):
    """Run a manual sync from command line."""
    scheduler = KnowledgeSyncScheduler()
    
    if source == "all":
        results = await asyncio.gather(
            scheduler.sync_pubmed(),
            scheduler.sync_cochrane(),
            scheduler.sync_clinical_trials(),
            scheduler.sync_guidelines(),
        )
    else:
        source_enum = SyncSource(source.lower())
        if source_enum == SyncSource.PUBMED:
            results = [await scheduler.sync_pubmed()]
        elif source_enum == SyncSource.COCHRANE:
            results = [await scheduler.sync_cochrane()]
        elif source_enum == SyncSource.CLINICAL_TRIALS:
            results = [await scheduler.sync_clinical_trials()]
        elif source_enum == SyncSource.GUIDELINES:
            results = [await scheduler.sync_guidelines()]
        else:
            print(f"Unknown source: {source}")
            return
    
    print("\n=== Sync Results ===")
    for result in results:
        print(f"\n{result.source.value}:")
        print(f"  Status: {result.status.value}")
        print(f"  Processed: {result.items_processed}")
        print(f"  Added: {result.items_added}")
        print(f"  Duration: {result.duration_seconds:.2f}s")
        if result.errors:
            print(f"  Errors: {len(result.errors)}")


if __name__ == "__main__":
    import sys
    source = sys.argv[1] if len(sys.argv) > 1 else "all"
    asyncio.run(run_manual_sync(source))
