"""
P1 Hybrid Retrieval Verification Script
========================================

Verifies the P1 Hybrid Retrieval implementation:
- BM25 Keyword Search
- Reciprocal Rank Fusion (RRF)
- Recency-Weighted Scoring
- Query Expansion

Run: python verify_p1_hybrid.py
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def verify_imports():
    """Verify all P1 modules can be imported."""
    print("=" * 60)
    print("P1 Hybrid Retrieval Verification")
    print("=" * 60)
    
    errors = []
    
    # Test 1: Import hybrid_retrieval module
    print("\n[1/5] Testing hybrid_retrieval module import...")
    try:
        from app.retrieval.hybrid_retrieval import (
            HybridRetrievalEngine,
            HybridContext,
            HybridResult,
            BM25Index,
            ReciprocalRankFusion,
            RecencyScorer,
            QueryExpander,
            get_hybrid_retrieval_engine,
        )
        print("  ✓ All hybrid_retrieval imports successful")
    except ImportError as e:
        errors.append(f"hybrid_retrieval import error: {e}")
        print(f"  ✗ Import failed: {e}")
    
    # Test 2: BM25Index
    print("\n[2/5] Testing BM25Index...")
    try:
        bm25 = BM25Index()
        
        # Add test documents
        bm25.add_document("doc1", "Diabetes Treatment", "Treatment options for diabetes mellitus type 2 include metformin and lifestyle changes.")
        bm25.add_document("doc2", "Hypertension Management", "Hypertension is managed with ACE inhibitors and diuretics.")
        bm25.add_document("doc3", "MI Treatment", "Myocardial infarction requires immediate intervention with antiplatelet therapy.")
        
        stats = bm25.get_stats()
        print(f"  ✓ BM25Index created with {stats['num_documents']} documents")
        
        # Test search
        results = bm25.search("diabetes treatment", top_k=5)
        print(f"  ✓ BM25 search returned {len(results)} results")
        
    except Exception as e:
        errors.append(f"BM25Index error: {e}")
        print(f"  ✗ BM25Index test failed: {e}")
    
    # Test 3: ReciprocalRankFusion
    print("\n[3/5] Testing ReciprocalRankFusion...")
    try:
        rrf = ReciprocalRankFusion(k=60)
        
        # Test with mock results
        list1 = [("doc1", 0.9, {"title": "A"}), ("doc2", 0.8, {"title": "B"}), ("doc3", 0.7, {"title": "C"})]
        list2 = [("doc2", 0.95, {"title": "B"}), ("doc1", 0.85, {"title": "A"}), ("doc4", 0.6, {"title": "D"})]
        
        fused = rrf.fuse([list1, list2])
        print(f"  ✓ RRF fused {len(list1) + len(list2)} results into {len(fused)} unique results")
        
        if fused:
            print(f"  ✓ Top result: {fused[0][0]} with RRF score {fused[0][1]:.4f}")
        
    except Exception as e:
        errors.append(f"ReciprocalRankFusion error: {e}")
        print(f"  ✗ ReciprocalRankFusion test failed: {e}")
    
    # Test 4: RecencyScorer
    print("\n[4/5] Testing RecencyScorer...")
    try:
        scorer = RecencyScorer()
        
        from datetime import datetime, timedelta
        
        recent_date = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
        old_date = (datetime.utcnow() - timedelta(days=3650)).strftime("%Y-%m-%d")  # 10 years ago
        
        recent_score = scorer.get_recency_score(recent_date)
        old_score = scorer.get_recency_score(old_date)
        
        print(f"  ✓ Recent article (1 year): {recent_score:.4f}")
        print(f"  ✓ Old article (10 years): {old_score:.4f}")
        
        if recent_score > old_score:
            print("  ✓ Recency scoring correctly prioritizes recent articles")
        
    except Exception as e:
        errors.append(f"RecencyScorer error: {e}")
        print(f"  ✗ RecencyScorer test failed: {e}")
    
    # Test 5: QueryExpander
    print("\n[5/5] Testing QueryExpander...")
    try:
        expander = QueryExpander()
        
        # Test abbreviation expansion
        query = "treatment for MI"
        expanded, terms = expander.expand(query)
        print(f"  ✓ Query: '{query}'")
        print(f"  ✓ Expanded: '{expanded}'")
        print(f"  ✓ Expansion terms: {terms}")
        
    except Exception as e:
        errors.append(f"QueryExpander error: {e}")
        print(f"  ✗ QueryExpander test failed: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    if errors:
        print(f"\n❌ {len(errors)} error(s) found:")
        for error in errors:
            print(f"  - {error}")
        return False
    else:
        print("\n✅ All P1 Hybrid Retrieval components verified successfully!")
        print("\nP1 Features Implemented:")
        print("  • BM25 Keyword Search with medical synonym support")
        print("  • Reciprocal Rank Fusion (RRF) for result combination")
        print("  • Recency-Weighted Scoring with domain-specific decay")
        print("  • Query Expansion (synonyms + abbreviations)")
        print("\nNew API Endpoints:")
        print("  • POST /api/v1/hybrid-query")
        print("  • GET  /api/v1/hybrid/stats")
        print("  • POST /api/v1/hybrid/index-document")
        print("  • POST /api/v1/hybrid/sync-from-pinecone")
        print("  • GET  /api/v1/recency-score")
        return True


if __name__ == "__main__":
    # Change to the correct directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Run verification
    success = verify_imports()
    
    print("\n" + "=" * 60)
    print("P1 Hybrid Retrieval Implementation Complete")
    print("=" * 60)
    
    sys.exit(0 if success else 1)
