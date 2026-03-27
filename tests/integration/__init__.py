"""
Integration Tests for Gelani Healthcare Assistant
==================================================

Comprehensive integration tests covering:
- Diagnostic workflow completeness
- Antimicrobial safety (allergy blocking, DDI detection)
- Renal dosing calculations (Cockcroft-Gault)
- ECG QTc calculations (all formulas, gender-aware thresholds)
- Authentication security (token validation, tampering detection)
- RAG citation integrity (PubMed ID validation, namespace routing)

Prerequisites:
1. Medical RAG service running on port 3031
2. PubMed ingestion completed (P9) for citation tests
3. TEST_SESSION_SECRET environment variable set

Run with:
    make test-integration
    # or
    pytest tests/integration/ -v --tb=short --timeout=30
"""
