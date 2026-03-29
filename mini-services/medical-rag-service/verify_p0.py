"""
P0 Implementation Verification Script
=====================================

Verifies that all P0 components are correctly implemented.
"""

import os
import sys

# Add the app directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def verify_config():
    """Verify config has PubMedBERT settings."""
    print("=" * 60)
    print("Verifying Configuration...")
    print("=" * 60)
    
    from app.core.config import get_settings
    settings = get_settings()
    
    checks = {
        "EMBEDDING_MODEL": settings.EMBEDDING_MODEL,
        "PUBMEDBERT_MODEL": settings.PUBMEDBERT_MODEL,
        "EMBEDDING_DIMENSION": settings.EMBEDDING_DIMENSION,
        "EMBEDDING_WARMUP_ON_STARTUP": settings.EMBEDDING_WARMUP_ON_STARTUP,
        "PINECONE_NAMESPACE": settings.PINECONE_NAMESPACE,
        "PINECONE_INDEX_NAME": settings.PINECONE_INDEX_NAME,
    }
    
    all_passed = True
    for key, value in checks.items():
        status = "✓" if value else "✗"
        if "PUBMEDBERT" in key or "EMBEDDING_MODEL" in key:
            expected = "NeuML/pubmedbert-base-embeddings"
            if value == expected:
                print(f"  {status} {key}: {value}")
            else:
                print(f"  {status} {key}: {value} (expected: {expected})")
                all_passed = False
        else:
            print(f"  {status} {key}: {value}")
    
    return all_passed


def verify_pubmedbert_service():
    """Verify PubMedBERT service structure."""
    print("\n" + "=" * 60)
    print("Verifying PubMedBERT Service...")
    print("=" * 60)
    
    try:
        from app.embedding.pubmedbert_embeddings import (
            PubMedBERTEmbeddingService,
            PUBMEDBERT_MODEL,
            PUBMEDBERT_DIMENSION,
        )
        
        print(f"  ✓ PubMedBERTEmbeddingService class imported")
        print(f"  ✓ PUBMEDBERT_MODEL: {PUBMEDBERT_MODEL}")
        print(f"  ✓ PUBMEDBERT_DIMENSION: {PUBMEDBERT_DIMENSION}")
        
        # Verify class methods exist
        required_methods = [
            "initialize", "embed", "embed_batch", 
            "get_model_info", "get_stats", "_warmup"
        ]
        for method in required_methods:
            if hasattr(PubMedBERTEmbeddingService, method):
                print(f"  ✓ Method {method} exists")
            else:
                print(f"  ✗ Method {method} missing")
                return False
        
        return True
        
    except ImportError as e:
        print(f"  ✗ Import error: {e}")
        return False


def verify_reembedding_pipeline():
    """Verify re-embedding pipeline structure."""
    print("\n" + "=" * 60)
    print("Verifying Re-embedding Pipeline...")
    print("=" * 60)
    
    try:
        from app.embedding.reembed_pipeline import (
            ReembeddingPipeline,
            MigrationStatus,
            run_reembedding,
            estimate_migration_time,
        )
        
        print(f"  ✓ ReembeddingPipeline class imported")
        print(f"  ✓ MigrationStatus enum imported")
        print(f"  ✓ run_reembedding function imported")
        print(f"  ✓ estimate_migration_time function imported")
        
        # Verify MigrationStatus values
        for status in ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "PAUSED"]:
            if hasattr(MigrationStatus, status):
                print(f"  ✓ MigrationStatus.{status} exists")
            else:
                print(f"  ✗ MigrationStatus.{status} missing")
                return False
        
        return True
        
    except ImportError as e:
        print(f"  ✗ Import error: {e}")
        return False


def verify_main_endpoints():
    """Verify P0 endpoints exist in main.py."""
    print("\n" + "=" * 60)
    print("Verifying Main API Endpoints...")
    print("=" * 60)
    
    try:
        # Read main.py and check for endpoints
        with open("app/main.py", "r") as f:
            content = f.read()
        
        endpoints = [
            "/api/v1/embeddings/model-status",
            "/api/v1/embeddings/warmup",
            "/api/v1/embeddings/test",
            "/api/v1/reembedding/status",
            "/api/v1/reembedding/start",
        ]
        
        all_found = True
        for endpoint in endpoints:
            if endpoint in content:
                print(f"  ✓ Endpoint {endpoint} found")
            else:
                print(f"  ✗ Endpoint {endpoint} missing")
                all_found = False
        
        # Check for warmup on startup
        if "warmup_embedding_model" in content:
            print(f"  ✓ Warmup on startup implemented")
        else:
            print(f"  ✗ Warmup on startup missing")
            all_found = False
        
        return all_found
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def verify_rag_engine():
    """Verify RAG engine uses PubMedBERT service."""
    print("\n" + "=" * 60)
    print("Verifying RAG Engine Integration...")
    print("=" * 60)
    
    try:
        with open("app/retrieval/rag_engine.py", "r") as f:
            content = f.read()
        
        checks = [
            ("PubMedBERT service import", "get_pubmedbert_service"),
            ("embed method usage", "service.embed(text)"),
        ]
        
        all_found = True
        for name, pattern in checks:
            if pattern in content:
                print(f"  ✓ {name}")
            else:
                print(f"  ✗ {name} missing")
                all_found = False
        
        return all_found
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    """Run all verification checks."""
    print("\n" + "=" * 60)
    print("P0 IMPLEMENTATION VERIFICATION")
    print("=" * 60)
    
    results = {
        "Configuration": verify_config(),
        "PubMedBERT Service": verify_pubmedbert_service(),
        "Re-embedding Pipeline": verify_reembedding_pipeline(),
        "Main API Endpoints": verify_main_endpoints(),
        "RAG Engine Integration": verify_rag_engine(),
    }
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("ALL VERIFICATIONS PASSED")
    else:
        print("SOME VERIFICATIONS FAILED")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
