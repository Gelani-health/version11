# P1 Architecture Review: Dual RAG Services

## Executive Summary

This document provides a comprehensive architecture review of the Gelani Health dual RAG services before implementing P1 optimizations (Hybrid Retrieval, Multi-Query, RRF, Recency Scoring).

---

## 1. Service Architecture Overview

### 1.1 Medical RAG Service (Port 3031) - PRIMARY

| Component | Details |
|-----------|---------|
| **Role** | Primary diagnostic engine |
| **Embedding Model** | PubMedBERT (NeuML/pubmedbert-base-embeddings) |
| **Embedding Dimension** | 768 |
| **Vector ID Format** | `pmid_{pmid}_chunk_{index}` (NO prefix) |
| **source_pipeline** | Not set / "custom_rag" |
| **Pinecone Namespace** | `pubmed` (shared) |

**Current Retrieval Pipeline:**
```
Query → PubMedBERT Embedding → Pinecone Semantic Search → Simple Rerank (score*0.8 + recency*0.2) → Results
```

**Key Features:**
- P0: PubMedBERT embeddings with warmup on startup
- P2: Redis caching, MeSH query expansion, Prometheus metrics
- P3: Clinical alerts, lab interpretation, antimicrobial stewardship, imaging decision support

**Gap Analysis:**
- ❌ No BM25/keyword search
- ❌ No multi-query generation
- ❌ No RRF fusion
- ❌ No query decomposition
- ✅ Has query expansion (MeSH terms)

---

### 1.2 LangChain RAG Service (Port 3032) - SECONDARY

| Component | Details |
|-----------|---------|
| **Role** | Secondary service with fallback chain |
| **Embedding Model** | all-mpnet-base-v2 (general-purpose) |
| **Embedding Dimension** | 768 |
| **Vector ID Format** | `lc_pmid_{pmid}_chunk_{index}` (lc_ prefix) |
| **source_pipeline** | "langchain" |
| **Pinecone Namespace** | `pubmed` (shared) |

**Current Retrieval Pipeline (4-Stage Fallback Chain):**
```
Stage 1: Primary (threshold 0.60)
  └── Cache Check → Semantic Search → Cross-Encoder Re-ranking → Threshold Check
       ↓ FAIL
Stage 2: Fallback 1 (threshold 0.40)
  └── Lower threshold, return results
       ↓ FAIL
Stage 3: Fallback 2 (threshold 0.25)
  └── Simplified query → Semantic Search → Return results
       ↓ FAIL
Stage 4: Fallback 3 (No RAG)
  └── Direct LLM generation with warning
```

**Key Features:**
- ✅ Cross-encoder re-ranking (ms-marco-MiniLM-L-6-v2)
- ✅ Fallback chain with multiple stages
- ✅ In-memory caching
- ✅ Query simplification for fallback

**Gap Analysis:**
- ❌ No BM25/keyword search
- ❌ No multi-query generation
- ❌ No RRF fusion
- ❌ No query decomposition

---

## 2. Cross-Pipeline Synchronization

### 2.1 Enhanced Sync Architecture (P3)

The cross-pipeline sync enables bidirectional data flow between services:

```
┌─────────────────────┐                    ┌─────────────────────┐
│   Medical RAG       │                    │   LangChain RAG     │
│   (Port 3031)       │                    │   (Port 3032)       │
│                     │                    │                     │
│  Vector ID:         │                    │  Vector ID:         │
│  pmid_{id}_chunk_{n}│                    │  lc_pmid_{id}_...   │
│                     │                    │                     │
│  source_pipeline:   │                    │  source_pipeline:   │
│  (not set)          │                    │  "langchain"        │
└─────────┬───────────┘                    └──────────┬──────────┘
          │                                           │
          │         ┌─────────────────────┐           │
          └────────►│   Pinecone Index    │◄──────────┘
                    │   Namespace: pubmed │
                    │                     │
                    │  Shared 768-dim     │
                    │  vector space       │
                    └─────────────────────┘
```

### 2.2 Sync Features

| Feature | Description |
|---------|-------------|
| **Bidirectional Sync** | Syncs vectors between services |
| **Conflict Resolution** | medical_wins, langchain_wins, newest_wins, keep_both, manual |
| **Incremental Sync** | Delta-based sync for recent changes |
| **Health Monitoring** | Tracks sync lag, divergence score |

### 2.3 Conflict Resolution Strategy

Default: `medical_wins` (Medical RAG is source of truth for PubMed data)

---

## 3. P1 Implementation Strategy

### 3.1 Design Principles

1. **Medical RAG as Primary**: Add all P1 features here since it's the main diagnostic engine
2. **LangChain RAG as Secondary**: Leverage existing cross-encoder and fallback chain
3. **Cross-Pipeline Sync**: Sync BM25 index from Medical RAG to LangChain

### 3.2 Feature Placement

| P1 Feature | Medical RAG (3031) | LangChain RAG (3032) |
|------------|--------------------|-----------------------|
| **BM25 Hybrid Retrieval** | ✅ Implement (Primary) | 🔄 Sync from Medical |
| **Multi-Query Generation** | ✅ Implement (Primary) | ❌ Not needed (has fallback) |
| **RRF Fusion** | ✅ Implement (Primary) | 🔄 Sync results |
| **Recency Scoring** | ✅ Enhance existing | ✅ Already has simple version |
| **Query Decomposition** | ✅ Implement (Primary) | ❌ Not needed (has fallback) |

### 3.3 Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Medical RAG Service (3031)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  P1: Hybrid Retrieval Pipeline                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Query                                                       │    │
│  │    │                                                         │    │
│  │    ▼                                                         │    │
│  │  ┌──────────────────┐    ┌──────────────────┐               │    │
│  │  │ Query Expansion  │───►│ Multi-Query Gen  │               │    │
│  │  │ (MeSH + Synonyms)│    │ (3-5 variations) │               │    │
│  │  └──────────────────┘    └────────┬─────────┘               │    │
│  │                                    │                         │    │
│  │                    ┌───────────────┼───────────────┐        │    │
│  │                    ▼               ▼               ▼        │    │
│  │            ┌──────────────┐ ┌──────────────┐ ┌────────────┐│    │
│  │            │ BM25 Search  │ │ Semantic     │ │ Query      ││    │
│  │            │ (Keyword)    │ │ Search       │ │ Decomp     ││    │
│  │            └──────┬───────┘ └──────┬───────┘ └─────┬──────┘│    │
│  │                   │                │               │        │    │
│  │                   ▼                ▼               ▼        │    │
│  │            ┌──────────────────────────────────────────┐    │    │
│  │            │       RRF Fusion (k=60)                  │    │    │
│  │            │   35% BM25 + 65% Semantic                │    │    │
│  │            └───────────────────┬──────────────────────┘    │    │
│  │                                │                           │    │
│  │                                ▼                           │    │
│  │            ┌──────────────────────────────────────────┐    │    │
│  │            │    Recency-Weighted Scoring (15%)        │    │    │
│  │            │    Domain-specific decay rates           │    │    │
│  │            └───────────────────┬──────────────────────┘    │    │
│  │                                │                           │    │
│  │                                ▼                           │    │
│  │                     Final Ranked Results                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  BM25 Index Storage: In-memory (synced from Pinecone on startup)    │
│                                                                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ Cross-Pipeline Sync
                                   │ (/api/v1/hybrid/sync-from-pinecone)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LangChain RAG Service (3032)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Existing Fallback Chain (Keep as-is)                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Stage 1: Semantic + Cross-Encoder (threshold 0.60)         │    │
│  │  Stage 2: Lower threshold (0.40)                            │    │
│  │  Stage 3: Simplified query (0.25)                           │    │
│  │  Stage 4: Direct LLM (no RAG)                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  BM25 Index: Synced from Medical RAG (optional use)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Specifications

### 4.1 BM25 Parameters (Medical Domain Optimized)

```python
BM25_CONFIG = {
    "k1": 1.5,      # Term frequency saturation
    "b": 0.75,      # Document length normalization
    "epsilon": 0.25 # Floor for IDF scores
}
```

### 4.2 RRF Parameters

```python
RRF_CONFIG = {
    "k": 60,                    # RRF constant
    "bm25_weight": 0.35,        # 35% keyword
    "semantic_weight": 0.65,    # 65% semantic (medical domain prefers semantic)
    "recency_weight": 0.15      # 15% recency adjustment
}
```

### 4.3 Multi-Query Generation

```python
MULTI_QUERY_CONFIG = {
    "num_variations": 3,        # Generate 3 query variations
    "strategies": [
        "synonym_expansion",    # MeSH synonyms
        "abbreviation_expansion", # Medical abbreviations
        "simplification"        # Remove stop words
    ]
}
```

### 4.4 Recency Decay Rates (Domain-Specific)

```python
RECENCY_DECAY = {
    "guidelines": 730,      # 2 years (guidelines change slowly)
    "clinical_trials": 365, # 1 year
    "case_reports": 1825,   # 5 years (historical value)
    "general": 1095         # 3 years default
}
```

---

## 5. API Endpoints (Medical RAG)

### 5.1 New Hybrid Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/hybrid-query` | POST | Full hybrid retrieval |
| `/api/v1/hybrid/stats` | GET | BM25 index statistics |
| `/api/v1/hybrid/index-document` | POST | Add document to BM25 index |
| `/api/v1/hybrid/sync-from-pinecone` | POST | Sync BM25 from Pinecone vectors |
| `/api/v1/hybrid/clear-index` | DELETE | Clear BM25 index |
| `/api/v1/recency-score` | GET | Calculate recency score |

### 5.2 Sync Endpoint (LangChain RAG)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sync/bm25-index` | POST | Sync BM25 index from Medical RAG |

---

## 6. Implementation Checklist

### Phase 1: Medical RAG Core Components
- [ ] Create `hybrid_retrieval.py` with BM25 + RRF
- [ ] Create `multi_query.py` with query variations
- [ ] Create `query_decomposition.py` for complex queries
- [ ] Add recency-weighted scoring
- [ ] Update `rag_engine.py` to use hybrid retrieval

### Phase 2: API Integration
- [ ] Add hybrid query endpoint
- [ ] Add BM25 index management endpoints
- [ ] Add sync endpoint for Pinecone → BM25
- [ ] Update documentation

### Phase 3: Cross-Pipeline Sync
- [ ] Add BM25 sync to LangChain RAG
- [ ] Update enhanced_sync.py for hybrid data
- [ ] Test bidirectional sync

### Phase 4: Testing & Validation
- [ ] Unit tests for BM25
- [ ] Unit tests for RRF
- [ ] Integration tests
- [ ] Performance benchmarks
- [ ] Accuracy evaluation

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BM25 memory usage | High for large indices | Lazy loading, document sampling |
| Embedding model mismatch | Both use 768-dim but different models | Use Pinecone with shared namespace, accept slight semantic drift |
| Sync latency | Index drift between services | Incremental sync with health monitoring |
| Query complexity | Slower response times | Parallel query execution, caching |

---

## 8. Conclusion

The architecture supports P1 implementation with clear separation:

1. **Medical RAG** gets full P1 features (BM25, multi-query, RRF, recency, decomposition)
2. **LangChain RAG** keeps existing fallback chain with optional BM25 sync
3. **Cross-pipeline sync** ensures data consistency

This approach maximizes the strengths of each service while maintaining clean architecture boundaries.
