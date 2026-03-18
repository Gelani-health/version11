# Gelani AI Healthcare Assistant - Architecture Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Layers](#2-architecture-layers)
3. [Mini-Services](#3-mini-services)
4. [Data Flow](#4-data-flow)
5. [API Reference](#5-api-reference)
6. [Configuration](#6-configuration)
7. [Deployment](#7-deployment)
8. [Security](#8-security)
9. [Monitoring](#9-monitoring)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. System Overview

### 1.1 Purpose

Gelani AI Healthcare Assistant is an AI-powered clinical decision support system designed to assist healthcare professionals with:

- Medical diagnostics and clinical decision support
- Drug interaction checking
- Voice-to-text transcription for medical documentation
- Medical literature search via RAG (Retrieval-Augmented Generation)
- Patient management and consultation tracking

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | Next.js + React | 16.x |
| Backend | Node.js + Bun | Latest |
| Mini-Services | Python + FastAPI | 3.12 / 0.109+ |
| Database | SQLite + Prisma ORM | Latest |
| Vector Store | Pinecone | 3.0+ |
| LLM | Z.AI GLM-4.7-Flash | Latest |
| Speech Recognition | Google MedASR | Conformer-based |

### 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                          │
│                     (React + Next.js Frontend)                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APPLICATION                       │
│                            Port 3000                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pages     │  │  API Route  │  │ Components  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │ Medical   │ │ LangChain │ │  MedASR   │
            │ RAG :3031 │ │ RAG :3032 │ │  :3033    │
            └───────────┘ └───────────┘ └───────────┘
                    │             │             │
                    └─────────────┼─────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Pinecone │  │   Z.AI   │  │  NCBI/   │  │ Hugging  │        │
│  │  Vector  │  │   LLM    │  │ PubMed   │  │  Face    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Layers

### 2.1 Presentation Layer (Frontend)

**Location**: `src/app/`, `src/components/`

**Port**: 3000

**Components**:

| Module | File | Description |
|--------|------|-------------|
| Dashboard | `page.tsx` | Main dashboard with statistics |
| Patients | `patient-management.tsx` | Patient registration and management |
| Consultations | `consultation-module.tsx` | Clinical consultations |
| Medical RAG | `medical-rag-diagnostic.tsx` | Medical literature search |
| Healthcare AI | `healthcare-ai-features.tsx` | AI-powered features |
| Clinical Support | `clinical-decision-support.tsx` | Decision support tools |
| Drug Safety | `patient-drug-checker.tsx` | Drug interaction checking |
| Voice Input | `medasr-input.tsx` | Voice-to-text input |

### 2.2 API Layer

**Location**: `src/app/api/`

**Routes**:

| Endpoint | File | Purpose |
|----------|------|---------|
| `/api/asr` | `api/asr/route.ts` | Speech recognition proxy |
| `/api/llm-integrations` | `api/llm-integrations/route.ts` | LLM configuration |
| `/api/rag` | `api/rag/route.ts` | RAG queries |

### 2.3 Service Layer (Mini-Services)

**Location**: `mini-services/`

| Service | Port | Language | Purpose |
|---------|------|----------|---------|
| Medical RAG | 3031 | Python/FastAPI | Medical diagnostics RAG |
| LangChain RAG | 3032 | Python/FastAPI | Document management RAG |
| MedASR | 3033 | Python/FastAPI | Medical speech recognition |

### 2.4 Data Layer

**Location**: `prisma/`, `db/`

| Component | Type | Description |
|-----------|------|-------------|
| SQLite | Database | Local data storage |
| Prisma | ORM | Database abstraction |
| Pinecone | Vector DB | Embedding storage |

---

## 3. Mini-Services

### 3.1 Medical RAG Service (Port 3031)

**Location**: `mini-services/medical-rag-service/`

**Purpose**: Medical diagnostic RAG with PubMed/PMC integration

**Features**:
- PubMed/PMC article search
- Pinecone vector storage
- GLM-4.7-Flash LLM integration
- Medical query expansion
- MeSH term filtering
- Diagnostic suggestions

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/query` | Medical query with RAG |
| POST | `/diagnose` | Diagnostic suggestions |
| POST | `/search` | PubMed article search |
| POST | `/ingest` | Ingest articles to vector store |

**Configuration**:

| Setting | Value | Description |
|---------|-------|-------------|
| PORT | 3031 | Service port |
| PINECONE_API_KEY | pcsk_57cp... | Pinecone authentication |
| ZAI_API_KEY | f631a18a... | Z.AI LLM access |
| NCBI_API_KEY | 25b0fc18... | PubMed access |
| GLM_MODEL | glm-4.7-flash | LLM model name |

---

### 3.2 LangChain RAG Service (Port 3032)

**Location**: `mini-services/langchain-rag-service/`

**Purpose**: Document management RAG with READ/WRITE capabilities

**Features**:
- READ/WRITE mode
- Smart sync functionality
- Document chunking
- Pinecone vector storage
- GLM-4.7-Flash integration
- Specialty filtering

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/query` | RAG query |
| POST | `/documents` | Add documents |
| GET | `/specialties` | Medical specialties list |
| GET | `/stats` | Vector store statistics |

**Configuration**:

| Setting | Value | Description |
|---------|-------|-------------|
| PORT | 3032 | Service port |
| MODE | READ_WRITE | Service mode |
| SYNC | enabled | Smart sync |

---

### 3.3 MedASR Service (Port 3033)

**Location**: `mini-services/medasr-service/`

**Purpose**: Medical speech recognition using Google's MedASR model

**Features**:
- Google MedASR model (Conformer-based)
- 4.6% Word Error Rate
- 105M parameters
- CTC decoding with epsilon removal
- Medical terminology optimization
- 16kHz audio support

**Model Specifications**:

| Specification | Value |
|--------------|-------|
| Model | google/medasr |
| Parameters | 105M |
| WER | 4.6% |
| Architecture | Conformer |
| Sample Rate | 16kHz |

**CTC Decoding Flow**:

```
Raw Audio (16kHz mono)
        │
        ▼
┌───────────────────┐
│   Feature         │
│   Extraction      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   Conformer       │
│   Encoder         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   CTC Collapse    │  ← Collapse repeated tokens
│   (remove blanks) │  ← Remove <epsilon> tokens
└───────────────────┘
        │
        ▼
   Final Text
```

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/transcribe` | Transcribe base64 audio |
| POST | `/transcribe/file` | Transcribe audio file |
| GET | `/medical-terms` | Medical term corrections |

---

## 4. Data Flow

### 4.1 Voice Input Flow

```
User Speaks
     │
     ▼
Browser Microphone (MediaRecorder)
     │
     ▼
Base64 Audio Encoding
     │
     ▼
POST /api/asr (Next.js)
     │
     ▼
POST /transcribe (MedASR :3033)
     │
     ▼
Google MedASR Model
     │
     ▼
CTC Decoding + Medical Post-process
     │
     ▼
Text Transcription
```

### 4.2 RAG Query Flow

```
User Query
     │
     ▼
Frontend Form
     │
     ▼
POST /query (RAG Service :3031/:3032)
     │
     ▼
┌─────────────────────────────────────┐
│         Query Processing            │
│  • Query expansion                   │
│  • Medical term recognition         │
│  • Specialty filtering               │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│        Pinecone Vector Search       │
│  • Embedding generation              │
│  • Similarity search                 │
│  • Top-K retrieval                   │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│          Context Building           │
│  • Document concatenation            │
│  • Source attribution                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│       Z.AI GLM-4.7-Flash LLM        │
│  • Context-aware generation          │
│  • Medical knowledge integration     │
└─────────────────────────────────────┘
     │
     ▼
Response with Sources
```

### 4.3 Clinical Decision Support Flow

```
Patient Symptoms + Context
           │
           ▼
┌─────────────────────────────────────┐
│        Diagnostic Processing        │
│  • Extract key symptoms              │
│  • Identify relevant specialties     │
│  • Apply patient context             │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│           RAG Retrieval             │
│  • Medical literature search         │
│  • Clinical guidelines lookup        │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│           LLM Analysis              │
│  • Differential diagnoses            │
│  • Recommended tests                 │
│  • Risk assessment                   │
└─────────────────────────────────────┘
           │
           ▼
Diagnostic Recommendations
```

---

## 5. API Reference

### 5.1 Medical RAG Service (Port 3031)

#### Health Check

```http
GET /health

Response:
{
  "status": "healthy",
  "services": {
    "pinecone": "configured",
    "llm": "configured"
  },
  "timestamp": "2024-01-15T10:30:00",
  "version": "1.0.0"
}
```

#### Query

```http
POST /query
Content-Type: application/json

{
  "query": "What are the side effects of metformin?",
  "patient_context": {
    "age": 65,
    "gender": "male",
    "conditions": ["diabetes", "hypertension"]
  },
  "specialty": "endocrinology",
  "top_k": 10,
  "min_score": 0.5
}
```

### 5.2 LangChain RAG Service (Port 3032)

#### Query

```http
POST /query
Content-Type: application/json

{
  "query": "diabetes management guidelines",
  "top_k": 5,
  "min_score": 0.3,
  "specialty": "endocrinology",
  "include_sources": true,
  "generate_answer": true
}
```

#### Add Documents

```http
POST /documents
Content-Type: application/json

{
  "documents": [
    {
      "content": "Full text of medical document...",
      "metadata": {
        "source": "internal-kb",
        "type": "protocol",
        "specialty": "cardiology"
      }
    }
  ]
}
```

### 5.3 MedASR Service (Port 3033)

#### Transcribe

```http
POST /transcribe
Content-Type: application/json

{
  "audio_base64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA...",
  "sample_rate": 16000,
  "language": "en",
  "context": "medical",
  "enable_medical_postprocess": true
}

Response:
{
  "success": true,
  "transcription": "Patient presents with severe headache",
  "confidence": 0.95,
  "word_count": 6,
  "processing_time_ms": 1234.56,
  "medical_terms_detected": ["headache → Headache"],
  "engine": "medasr"
}
```

---

## 6. Configuration

### 6.1 Environment Variables

```bash
# .env file

# Z.AI Configuration
ZAI_API_KEY=f631a18af3784849a366b18e513c4ca3
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
GLM_MODEL=glm-4.7-flash

# Pinecone Configuration
PINECONE_API_KEY=pcsk_57cpCV_8i4dNCraxqLetEckEEJP
PINECONE_INDEX_NAME=medical-diagnostic-rag
PINECONE_NAMESPACE=pubmed

# NCBI Configuration
NCBI_API_KEY=25b0fc18f6507e7190c88bd59aaf1a6cc609
NCBI_EMAIL=info@gelani-health.ai

# HuggingFace (for MedASR)
HF_TOKEN=YOUR_HUGGINGFACE_TOKEN_HERE

# Service Ports
MEDICAL_RAG_PORT=3031
LANGCHAIN_RAG_PORT=3032
MEDASR_PORT=3033
```

### 6.2 Service Configuration Files

Each mini-service has its own `package.json`:

```json
// medical-rag-service/package.json
{
  "name": "medical-rag-service",
  "version": "1.0.0",
  "port": 3031,
  "scripts": {
    "dev": "bun --hot index.py",
    "start": "python index.py"
  }
}
```

---

## 7. Deployment

### 7.1 Start Services

```bash
# Start Medical RAG
cd /home/z/my-project/mini-services/medical-rag-service
source venv/bin/activate
nohup python index.py > /home/z/medical-rag.log 2>&1 &

# Start LangChain RAG
cd /home/z/my-project/mini-services/langchain-rag-service
source venv/bin/activate
nohup python index.py > /home/z/langchain-rag.log 2>&1 &

# Start MedASR
cd /home/z/my-project/mini-services/medasr-service
source venv/bin/activate
export HF_TOKEN="YOUR_HUGGINGFACE_TOKEN_HERE"
nohup python index.py > /home/z/medasr.log 2>&1 &

# Start Main App
cd /home/z/my-project
bun run dev
```

### 7.2 Check Service Status

```bash
# Check all ports
for port in 3000 3031 3032 3033; do
    if lsof -i:$port > /dev/null 2>&1; then
        echo "Port $port: ✓ Running"
    else
        echo "Port $port: ✗ Not running"
    fi
done
```

---

## 8. Security

### 8.1 API Key Management

| Service | Key Type | Storage |
|---------|----------|---------|
| Z.AI | API Key | Environment variable |
| Pinecone | API Key | Environment variable |
| NCBI | API Key | Environment variable |
| HuggingFace | Token | Environment variable |

### 8.2 Network Security

- Gateway: Caddy reverse proxy
- CORS: Configured per service
- Rate limiting: Service-level

---

## 9. Monitoring

### 9.1 Health Endpoints

All services expose `/health` endpoints:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### 9.2 Log Files

| Service | Log File |
|---------|----------|
| Medical RAG | `/home/z/medical-rag.log` |
| LangChain RAG | `/home/z/langchain-rag.log` |
| MedASR | `/home/z/medasr.log` |
| Main App | `/home/z/my-project/dev.log` |

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Service Not Starting

```bash
# Check if port is in use
lsof -i:3033

# Kill existing process
lsof -ti:3033 | xargs kill -9

# Check logs
tail -50 /home/z/medasr.log
```

#### Model Loading Failure

```bash
# Check HuggingFace token
curl -H "Authorization: Bearer YOUR_HUGGINGFACE_TOKEN_HERE" \
  https://huggingface.co/api/whoami-v2
```

#### Memory Issues

```bash
# Check memory usage
free -m

# Check disk space
df -h /
```

---

## Quick Reference

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Main App | http://localhost:3000 | Web interface |
| Medical RAG | http://localhost:3031 | Medical diagnostics |
| LangChain RAG | http://localhost:3032 | Document management |
| MedASR | http://localhost:3033 | Speech recognition |

### File Locations

```
/home/z/my-project/
├── src/                          # Frontend source
├── mini-services/                # Python services
│   ├── medical-rag-service/      # Port 3031
│   ├── langchain-rag-service/    # Port 3032
│   └── medasr-service/           # Port 3033
├── prisma/                       # Database schema
└── docs/                         # Documentation

/home/z/
├── medical-rag.log               # Medical RAG logs
├── langchain-rag.log             # LangChain RAG logs
└── medasr.log                    # MedASR logs
```

---

*Document Version: 1.0.0*
*Last Updated: March 2024*
