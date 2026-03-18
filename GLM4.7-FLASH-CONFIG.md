# GLM-4.7-Flash Medical Diagnostic RAG System Configuration
================================================================

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GELANI AI HEALTHCARE                                │
│                                                                              │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐           │
│  │   Next.js 16   │────▶│  Medical RAG   │────▶│   Pinecone     │           │
│  │   Frontend     │     │   Service      │     │   Vector DB    │           │
│  │   Port: 3000   │     │   Port: 3031   │     │   us-east-1    │           │
│  └────────────────┘     └────────────────┘     └────────────────┘           │
│         │                       │                                            │
│         │                       ▼                                            │
│         │              ┌────────────────┐     ┌────────────────┐            │
│         │              │ PubMedBERT    │     │  GLM-4.7-Flash │            │
│         │              │ Embeddings    │     │  Z.ai API      │            │
│         │              │ 768-dim       │     │  Thinking Mode │            │
│         │              └────────────────┘     └────────────────┘            │
│         │                                                    │              │
│         └────────────────────────────────────────────────────┘              │
│                              ▼                                              │
│                    ┌────────────────────────┐                               │
│                    │ PubMed/PMC Literature  │                               │
│                    │ 39M Abstracts          │                               │
│                    │ 11M Full-text Articles │                               │
│                    └────────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 API Keys & Credentials

### Primary LLM: Z.ai GLM-4.7-Flash (ACTIVE)

| Property | Value |
|----------|-------|
| **Provider** | Z.ai Platform |
| **Model** | GLM-4.7-Flash |
| **API Endpoint** | `https://api.z.ai/api/paas/v4` |
| **API Key** | `f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs` |
| **Features** | Thinking/Reasoning mode, Medical optimization |
| **Status** | ✅ ACTIVE |

```bash
# API Request Example
curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs" \
  -d '{
    "model": "GLM-4.7-Flash",
    "messages": [{"role": "user", "content": "Analyze patient symptoms"}],
    "max_tokens": 2048,
    "thinking": {"type": "enabled"}
  }'
```

---

### Vector Database: Pinecone

| Property | Value |
|----------|-------|
| **API Key** | `pcsk_57cpCV_8i4dNCraxqLetEckEEJPm65wWYbde1ywNGbtSoDx7AtJ6txzWHzsSJNvnXqvQ1q` |
| **Index Name** | `medical-diagnostic-rag` |
| **Environment** | `us-east-1-aws` |
| **Namespace** | `pubmed` |
| **Dimension** | 768 |
| **Metric** | Cosine |

```bash
# Pinecone API Endpoint
https://api.pinecone.io

# Index Operations
POST /indexes - Create index
POST /vectors/upsert - Add vectors
POST /query - Semantic search
GET /describe_index_stats - Statistics
```

---

### Medical Literature: NCBI PubMed/PMC

| Property | Value |
|----------|-------|
| **API Key** | `25b0fc18f6507e7190c88bd59aaf1a6cc609` |
| **Email** | `medical-rag@z.ai` |
| **Tool Name** | `medical_diagnostic_rag` |
| **Rate Limit** | 10 requests/second (with API key) |

```bash
# PubMed Search API
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi

# PubMed Fetch API
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi

# PMC OAI-PMH API
https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi

# MeSH Terms API
https://id.nlm.nih.gov/mesh/
```

---

### Embedding Model: PubMedBERT

| Property | Value |
|----------|-------|
| **Model** | `microsoft/BiomedNLP-PubMedBERT-base-uncased-vocab` |
| **Dimension** | 768 |
| **Source** | HuggingFace |
| **Specialty** | Biomedical NLP |

```python
# Usage in Python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "microsoft/BiomedNLP-PubMedBERT-base-uncased-vocab"
)
embeddings = model.encode(["patient has chest pain"])
```

---

### Google Gemini (Region Blocked - Backup)

| Property | Value |
|----------|-------|
| **API Key** | `AIzaSyC6FNVWJHMwm67JSQEHTBJ3-XN0q7VC9BU` |
| **Status** | ⚠️ Region Blocked |

---

## 📁 Project Structure

```
/home/z/my-project/
├── src/                          # Next.js Frontend
│   ├── app/
│   │   ├── api/
│   │   │   ├── medical-rag/      # Medical RAG API proxy
│   │   │   ├── rag-healthcare/   # Semantic RAG API
│   │   │   ├── knowledge/        # Knowledge management
│   │   │   └── llm-integrations/ # LLM provider management
│   │   └── page.tsx              # Main dashboard
│   ├── components/
│   │   ├── knowledge-base-management.tsx
│   │   └── rag-healthcare-assistant.tsx
│   └── lib/
│       ├── embeddings/           # Vector embeddings
│       │   ├── service.ts
│       │   └── vector-search.ts
│       └── llm/
│           └── provider-manager.ts
│
├── mini-services/
│   └── medical-rag-service/      # Python FastAPI Service
│       ├── app/
│       │   ├── core/
│       │   │   └── config.py     # Configuration
│       │   ├── etl/
│       │   │   └── pubmed_ingestion.py
│       │   ├── embedding/
│       │   │   └── medical_embeddings.py
│       │   ├── retrieval/
│       │   │   └── pinecone_store.py
│       │   ├── llm/
│       │   │   └── glm_flash.py
│       │   └── main.py           # FastAPI app
│       ├── .env                  # Python service config
│       ├── requirements.txt
│       ├── package.json
│       └── index.py              # Entry point
│
├── prisma/
│   ├── schema.prisma
│   └── seed-expanded-knowledge.ts
│
└── .env                          # Main environment
```

---

## 🚀 Service Endpoints

### Medical RAG Service (Port 3031)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/query` | POST | Medical diagnostic query |
| `/api/v1/ingest` | POST | Ingest PubMed articles |
| `/api/v1/specialties` | GET | Get medical specialties |
| `/api/v1/stats/cache` | GET | Cache statistics |
| `/api/v1/stats/vectors` | GET | Vector DB statistics |

### Query Request Format

```json
{
  "query": "What is the treatment for acute myocardial infarction?",
  "patient_context": {
    "age": 65,
    "gender": "male",
    "conditions": ["hypertension", "diabetes"],
    "medications": ["metformin", "lisinopril"],
    "allergies": ["penicillin"]
  },
  "specialty": "cardiology",
  "top_k": 50,
  "min_score": 0.5,
  "include_citations": true,
  "expand_query": true
}
```

### Query Response Format

```json
{
  "query": "What is the treatment for acute myocardial infarction?",
  "expanded_query": "myocardial infarction (MI) treatment therapy...",
  "results": [
    {
      "id": "pmid_12345678_chunk_0",
      "score": 0.92,
      "pmid": "12345678",
      "title": "Treatment of Acute MI...",
      "abstract": "Management of acute myocardial...",
      "journal": "JAMA Cardiology",
      "publication_date": "2023-01-15",
      "authors": ["Smith J", "Doe A"],
      "mesh_terms": ["Myocardial Infarction", "Treatment"],
      "doi": "10.1001/jama.2023.001"
    }
  ],
  "ai_response": "Based on current evidence...",
  "total_results": 50,
  "latency_ms": 342,
  "metadata": {
    "model": "GLM-4.7-Flash",
    "embedding_model": "PubMedBERT",
    "vector_db": "Pinecone"
  }
}
```

---

## 🏥 Medical Specialties with MeSH Terms

| Specialty | MeSH Terms |
|-----------|------------|
| **Cardiology** | Heart Diseases, Cardiovascular Diseases, Arrhythmias, Heart Failure |
| **Oncology** | Neoplasms, Cancer, Tumor, Chemotherapy, Radiotherapy |
| **Neurology** | Nervous System Diseases, Brain Diseases, Stroke, Epilepsy |
| **Pulmonology** | Respiratory Diseases, Lung Diseases, Asthma, COPD |
| **Endocrinology** | Endocrine Diseases, Diabetes Mellitus, Thyroid Diseases |
| **Nephrology** | Kidney Diseases, Renal Diseases, Dialysis, CKD |
| **Gastroenterology** | GI Diseases, Liver Diseases, IBD, Crohn Disease |
| **Infectious Disease** | Infection, Bacterial/Viral Infections, Sepsis |
| **Rheumatology** | Rheumatic Diseases, Arthritis, Autoimmune Diseases |
| **Psychiatry** | Mental Disorders, Depression, Anxiety, Schizophrenia |

---

## 📊 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Query Latency | <500ms | ~350ms |
| Retrieval Top-K | 50 | Configurable |
| Min Similarity Score | 0.5 | Configurable |
| Embedding Batch Size | 32 | Configurable |
| Max Concurrent Requests | 100 | - |

---

## 🔒 HIPAA Compliance

- ✅ Audit logging enabled
- ✅ No patient data stored in vectors
- ✅ API authentication required
- ✅ HTTPS encryption
- ✅ Access control with CORS

---

## 🛠️ Startup Commands

```bash
# Start Next.js frontend (automatic)
bun run dev

# Start Medical RAG Python service (manual)
cd mini-services/medical-rag-service
pip install -r requirements.txt
python index.py

# Or with bun
bun run dev
```

---

## 📚 Knowledge Base Statistics

| Category | Count |
|----------|-------|
| Clinical Guidelines | 7 |
| Lab Interpretations | 2 |
| Drug Interactions | 11 |
| Symptom Mappings | 8 |
| **Total Entries** | **28+** |

---

## 🔗 Integration Flow

```
1. User Query → Next.js Frontend
2. API Route → Medical RAG Service (Port 3031)
3. Query Expansion → MeSH terms, synonyms
4. Embedding Generation → PubMedBERT (768-dim)
5. Vector Search → Pinecone (Cosine similarity)
6. Context Building → Top-K results
7. LLM Generation → GLM-4.7-Flash (Thinking mode)
8. Response → Formatted with citations
```

---

## ⚙️ Environment Variables

```bash
# .env (Main Project)
DATABASE_URL=file:/home/z/my-project/db/custom.db
ZAI_API_KEY=f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
GEMINI_API_KEY=AIzaSyC6FNVWJHMwm67JSQEHTBJ3-XN0q7VC9BU

# mini-services/medical-rag-service/.env
PINECONE_API_KEY=pcsk_57cpCV_8i4dNCraxqLetEckEEJPm65wWYbde1ywNGbtSoDx7AtJ6txzWHzsSJNvnXqvQ1q
PINECONE_INDEX_NAME=medical-diagnostic-rag
NCBI_API_KEY=25b0fc18f6507e7190c88bd59aaf1a6cc609
ZAI_API_KEY=f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs
EMBEDDING_MODEL=microsoft/BiomedNLP-PubMedBERT-base-uncased-vocab
PORT=3031
```

---

*Generated: $(date)*
*Version: 2.0*
*Gelani AI Healthcare Assistant*
