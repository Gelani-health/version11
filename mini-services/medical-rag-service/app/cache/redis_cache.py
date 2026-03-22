"""
P2: Redis Caching Layer for Clinical Decision Support System
=============================================================

Implements intelligent caching for:
- Query results (TTL: 1 hour)
- Embedding vectors (TTL: 24 hours)
- LLM responses (TTL: 30 minutes)
- Drug interaction results (TTL: 7 days)
- Session state management
- Rate limiting

Fallback to in-memory cache if Redis unavailable.
"""

import asyncio
import hashlib
import json
import time
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps

from loguru import logger

# Try to import Redis, fall back to memory cache if unavailable
try:
    import redis.asyncio as redis
    from redis.asyncio import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("[Cache] Redis not available, using in-memory cache")


@dataclass
class CacheStats:
    """Cache statistics tracking."""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "deletes": self.deletes,
            "errors": self.errors,
            "hit_rate": f"{self.hit_rate:.2%}",
            "avg_latency_ms": self.total_latency_ms / max(1, self.hits + self.misses),
        }


class InMemoryCache:
    """In-memory cache fallback when Redis is unavailable."""
    
    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._max_size = max_size
    
    async def get(self, key: str) -> Optional[str]:
        entry = self._cache.get(key)
        if entry is None:
            return None
        if entry["expires_at"] < time.time():
            del self._cache[key]
            return None
        return entry["value"]
    
    async def set(self, key: str, value: str, ex: int = 3600) -> bool:
        # Evict old entries if at capacity
        if len(self._cache) >= self._max_size:
            # Remove oldest 10%
            sorted_keys = sorted(
                self._cache.keys(),
                key=lambda k: self._cache[k]["created_at"]
            )
            for k in sorted_keys[:self._max_size // 10]:
                del self._cache[k]
        
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ex,
            "created_at": time.time(),
        }
        return True
    
    async def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        entry = self._cache.get(key)
        if entry is None:
            return False
        if entry["expires_at"] < time.time():
            del self._cache[key]
            return False
        return True
    
    async def clear(self) -> bool:
        self._cache.clear()
        return True
    
    async def keys(self, pattern: str = "*") -> List[str]:
        return list(self._cache.keys())


class ClinicalCacheManager:
    """
    P2: Intelligent caching manager for Clinical Decision Support System.
    
    Features:
    - Redis primary with in-memory fallback
    - Semantic cache key generation
    - TTL management per data type
    - Rate limiting support
    - Session state management
    """
    
    # TTL constants (in seconds)
    QUERY_RESULT_TTL = 3600  # 1 hour
    EMBEDDING_TTL = 86400  # 24 hours
    LLM_RESPONSE_TTL = 1800  # 30 minutes
    DRUG_INTERACTION_TTL = 604800  # 7 days
    SAFETY_CHECK_TTL = 86400  # 24 hours
    SESSION_TTL = 7200  # 2 hours
    
    # Rate limiting
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 60  # seconds
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        prefix: str = "gelani:cds:",
    ):
        self.redis_url = redis_url or "redis://localhost:6379/0"
        self.prefix = prefix
        self._redis: Optional[Redis] = None
        self._memory_cache = InMemoryCache()
        self._use_redis = REDIS_AVAILABLE
        self._initialized = False
        self.stats = CacheStats()
        
        # Key prefixes for different data types
        self.KEY_PREFIXES = {
            "query": f"{prefix}query:",
            "embedding": f"{prefix}embed:",
            "llm": f"{prefix}llm:",
            "drug": f"{prefix}drug:",
            "safety": f"{prefix}safety:",
            "session": f"{prefix}session:",
            "rate_limit": f"{prefix}rate:",
        }
    
    async def initialize(self) -> bool:
        """Initialize cache connection."""
        if self._initialized:
            return True
        
        if not self._use_redis:
            logger.info("[Cache] Using in-memory cache (Redis unavailable)")
            self._initialized = True
            return True
        
        try:
            self._redis = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            await self._redis.ping()
            logger.info(f"[Cache] Connected to Redis: {self.redis_url}")
            self._initialized = True
            return True
        except Exception as e:
            logger.warning(f"[Cache] Redis connection failed: {e}, falling back to memory cache")
            self._use_redis = False
            self._initialized = True
            return True
    
    async def _get_client(self):
        """Get cache client (Redis or in-memory)."""
        if not self._initialized:
            await self.initialize()
        return self._redis if self._use_redis else self._memory_cache
    
    def _generate_key(self, prefix_type: str, *args, **kwargs) -> str:
        """Generate semantic cache key."""
        base = self.KEY_PREFIXES.get(prefix_type, self.prefix)
        
        # Create deterministic key from arguments
        key_parts = [str(arg) for arg in args if arg is not None]
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
        
        if not key_parts:
            return base
        
        content = ":".join(key_parts)
        # Hash long keys
        if len(content) > 100:
            hash_suffix = hashlib.md5(content.encode()).hexdigest()[:16]
            return f"{base}{hash_suffix}"
        
        return f"{base}{content}"
    
    def _hash_content(self, content: str) -> str:
        """Generate content hash for cache key."""
        return hashlib.md5(content.encode()).hexdigest()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        start_time = time.time()
        
        try:
            client = await self._get_client()
            value = await client.get(key)
            
            latency = (time.time() - start_time) * 1000
            self.stats.total_latency_ms += latency
            
            if value is not None:
                self.stats.hits += 1
                logger.debug(f"[Cache] HIT: {key[:50]}...")
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            
            self.stats.misses += 1
            logger.debug(f"[Cache] MISS: {key[:50]}...")
            return None
            
        except Exception as e:
            self.stats.errors += 1
            logger.error(f"[Cache] GET error: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600,
    ) -> bool:
        """Set value in cache with TTL."""
        start_time = time.time()
        
        try:
            client = await self._get_client()
            
            # Serialize value
            if isinstance(value, (dict, list)):
                serialized = json.dumps(value)
            else:
                serialized = str(value)
            
            await client.set(key, serialized, ex=ttl)
            
            self.stats.sets += 1
            logger.debug(f"[Cache] SET: {key[:50]}... (TTL: {ttl}s)")
            return True
            
        except Exception as e:
            self.stats.errors += 1
            logger.error(f"[Cache] SET error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            client = await self._get_client()
            await client.delete(key)
            self.stats.deletes += 1
            return True
        except Exception as e:
            self.stats.errors += 1
            logger.error(f"[Cache] DELETE error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        try:
            client = await self._get_client()
            return await client.exists(key)
        except Exception as e:
            logger.error(f"[Cache] EXISTS error: {e}")
            return False
    
    # ===== Specialized Cache Methods =====
    
    async def cache_query_result(
        self,
        query: str,
        results: Dict[str, Any],
        specialty: Optional[str] = None,
    ) -> bool:
        """Cache RAG query results."""
        key = self._generate_key("query", query, specialty=specialty)
        return await self.set(key, results, self.QUERY_RESULT_TTL)
    
    async def get_cached_query(
        self,
        query: str,
        specialty: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get cached query result."""
        key = self._generate_key("query", query, specialty=specialty)
        return await self.get(key)
    
    async def cache_embedding(
        self,
        text: str,
        embedding: List[float],
    ) -> bool:
        """Cache embedding vector."""
        text_hash = self._hash_content(text)
        key = self._generate_key("embedding", text_hash)
        return await self.set(key, embedding, self.EMBEDDING_TTL)
    
    async def get_cached_embedding(
        self,
        text: str,
    ) -> Optional[List[float]]:
        """Get cached embedding vector."""
        text_hash = self._hash_content(text)
        key = self._generate_key("embedding", text_hash)
        return await self.get(key)
    
    async def cache_llm_response(
        self,
        prompt_hash: str,
        response: str,
        model: str = "glm-4.7-flash",
    ) -> bool:
        """Cache LLM response."""
        key = self._generate_key("llm", prompt_hash, model=model)
        return await self.set(key, response, self.LLM_RESPONSE_TTL)
    
    async def get_cached_llm_response(
        self,
        prompt_hash: str,
        model: str = "glm-4.7-flash",
    ) -> Optional[str]:
        """Get cached LLM response."""
        key = self._generate_key("llm", prompt_hash, model=model)
        return await self.get(key)
    
    async def cache_drug_interaction(
        self,
        drug1: str,
        drug2: str,
        result: Dict[str, Any],
    ) -> bool:
        """Cache drug interaction result (long TTL)."""
        # Normalize drug names for consistent caching
        drugs = sorted([drug1.lower(), drug2.lower()])
        key = self._generate_key("drug", drugs[0], drugs[1])
        return await self.set(key, result, self.DRUG_INTERACTION_TTL)
    
    async def get_cached_drug_interaction(
        self,
        drug1: str,
        drug2: str,
    ) -> Optional[Dict[str, Any]]:
        """Get cached drug interaction result."""
        drugs = sorted([drug1.lower(), drug2.lower()])
        key = self._generate_key("drug", drugs[0], drugs[1])
        return await self.get(key)
    
    async def cache_safety_check(
        self,
        symptoms_hash: str,
        medications: List[str],
        result: Dict[str, Any],
    ) -> bool:
        """Cache safety check result."""
        meds_hash = self._hash_content(",".join(sorted(medications)))
        key = self._generate_key("safety", symptoms_hash, meds=meds_hash)
        return await self.set(key, result, self.SAFETY_CHECK_TTL)
    
    async def get_cached_safety_check(
        self,
        symptoms_hash: str,
        medications: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Get cached safety check result."""
        meds_hash = self._hash_content(",".join(sorted(medications)))
        key = self._generate_key("safety", symptoms_hash, meds=meds_hash)
        return await self.get(key)
    
    # ===== Session Management =====
    
    async def set_session_state(
        self,
        session_id: str,
        state: Dict[str, Any],
    ) -> bool:
        """Set session state."""
        key = self._generate_key("session", session_id)
        return await self.set(key, state, self.SESSION_TTL)
    
    async def get_session_state(
        self,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get session state."""
        key = self._generate_key("session", session_id)
        return await self.get(key)
    
    async def update_session_state(
        self,
        session_id: str,
        updates: Dict[str, Any],
    ) -> bool:
        """Update session state with new values."""
        current = await self.get_session_state(session_id) or {}
        current.update(updates)
        current["updated_at"] = datetime.utcnow().isoformat()
        return await self.set_session_state(session_id, current)
    
    # ===== Rate Limiting =====
    
    async def check_rate_limit(
        self,
        user_id: str,
        endpoint: str = "default",
    ) -> Dict[str, Any]:
        """
        Check rate limit for user.
        
        Returns:
            Dict with allowed, remaining, reset_time
        """
        key = self._generate_key("rate_limit", user_id, endpoint)
        
        try:
            client = await self._get_client()
            
            if self._use_redis:
                # Use Redis INCR for atomic rate limiting
                current = await client.incr(key)
                
                if current == 1:
                    # Set expiry on first request
                    await client.expire(key, self.RATE_LIMIT_WINDOW)
                
                ttl = await client.ttl(key)
                
                return {
                    "allowed": current <= self.RATE_LIMIT_REQUESTS,
                    "current": current,
                    "limit": self.RATE_LIMIT_REQUESTS,
                    "remaining": max(0, self.RATE_LIMIT_REQUESTS - current),
                    "reset_in_seconds": ttl,
                }
            else:
                # In-memory rate limiting (simplified)
                return {
                    "allowed": True,
                    "current": 0,
                    "limit": self.RATE_LIMIT_REQUESTS,
                    "remaining": self.RATE_LIMIT_REQUESTS,
                    "reset_in_seconds": self.RATE_LIMIT_WINDOW,
                }
                
        except Exception as e:
            logger.error(f"[Cache] Rate limit check error: {e}")
            # Allow on error
            return {
                "allowed": True,
                "current": 0,
                "limit": self.RATE_LIMIT_REQUESTS,
                "remaining": self.RATE_LIMIT_REQUESTS,
                "reset_in_seconds": 0,
            }
    
    # ===== Utility Methods =====
    
    async def clear_all(self) -> bool:
        """Clear all cached data (use with caution)."""
        try:
            client = await self._get_client()
            
            if self._use_redis:
                # Delete all keys with our prefix
                keys = await client.keys(f"{self.prefix}*")
                if keys:
                    await client.delete(*keys)
            else:
                await client.clear()
            
            logger.info("[Cache] All cached data cleared")
            return True
        except Exception as e:
            logger.error(f"[Cache] Clear error: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = self.stats.to_dict()
        
        try:
            client = await self._get_client()
            
            if self._use_redis:
                info = await client.info("memory")
                stats["redis_memory_used"] = info.get("used_memory_human", "unknown")
                stats["backend"] = "redis"
            else:
                stats["memory_entries"] = len(client._cache)
                stats["backend"] = "memory"
                
        except Exception as e:
            stats["backend_error"] = str(e)
        
        return stats
    
    async def close(self):
        """Close cache connection."""
        if self._redis:
            await self._redis.close()


# Singleton instance
_cache_manager: Optional[ClinicalCacheManager] = None


async def get_cache_manager() -> ClinicalCacheManager:
    """Get or create cache manager singleton."""
    global _cache_manager
    
    if _cache_manager is None:
        _cache_manager = ClinicalCacheManager()
        await _cache_manager.initialize()
    
    return _cache_manager


# Decorator for caching function results
def cached(ttl: int = 3600, key_prefix: str = ""):
    """
    Decorator for caching function results.
    
    Usage:
        @cached(ttl=1800, key_prefix="diagnosis")
        async def diagnose(symptoms: str) -> dict:
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = await get_cache_manager()
            
            # Generate cache key
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            if result is not None:
                await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator
