# Gelani AI Healthcare Assistant - Low-Level Architecture Documentation

**Generated:** March 17, 2026
**Version:** 1.0.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Network Architecture](#2-network-architecture)
3. [Service Architecture](#3-service-architecture)
4. [Traffic Flow](#4-traffic-flow)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [External Integrations](#7-external-integrations)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Persistence System](#9-persistence-system)
10. [Security & Configuration](#10-security--configuration)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                        Next.js 16 + React 19                                 │
│                          Port 3000 (External)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │   Patients   │  │ Consultation │  │   Clinical   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Voice     │  │  Drug Check  │  │  Lab Module  │  │    RAG       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (Caddy)                               │
│                      Port 80/443 (External Access)                           │
│                                                                              │
│   XTransformPort Query Parameter: Routes to internal ports                  │
│   Example: /api/endpoint?XTransformPort=3031                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐     ┌───────────────────┐     ┌───────────────┐
│  Medical RAG  │     │  LangChain RAG    │     │    MedASR     │
│   Port 3031   │     │    Port 3032      │     │   Port 3033   │
├───────────────┤     ├───────────────────┤     ├───────────────┤
│ PubMed/PMC    │     │ Pinecone R/W      │     │ Google MedASR │
│ Pinecone      │     │ Smart Sync        │     │ PyTorch       │
│ GLM-4.7-Flash │     │ GLM-4.7-Flash     │     │ Transformers  │
└───────┬───────┘     └─────────┬─────────┘     └───────────────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐     ┌───────────────┐
│   Pinecone    │     │   Z.AI GLM    │
│  Vector DB    │     │   4.7-Flash   │
│  (Cloud)      │     │   (Cloud)     │
└───────────────┘     └───────────────┘
```

---

## 2. Network Architecture

### Port Mapping

| Port | Service | Protocol | Access | Description |
|------|---------|----------|--------|-------------|
| 3000 | Next.js App | HTTP | External (via Caddy) | Main Web Application |
| 3031 | Medical RAG | HTTP | Internal | Diagnostic RAG Service |
| 3032 | LangChain RAG | HTTP | Internal | Document RAG Service |
| 3033 | MedASR | HTTP | Internal | Speech Recognition |
| 81 | Caddy Admin | HTTP | Internal | Gateway Admin |
| 19001 | Dev Server | HTTP | Internal | Development Server |
| 19005 | Sandbox | HTTP | Internal | Sandbox Service |
| 19006 | Sandbox | HTTP | Internal | Sandbox Service |

### Active Connections

```
External Traffic Flow:
─────────────────────

Internet → Caddy (Port 80/443)
              │
              ├──→ Next.js App (Port 3000) ──→ Internal Services
              │
              └──→ Direct Service Access (with XTransformPort)

Internal Traffic Flow:
─────────────────────

Next.js API Routes ──→ Mini-Services (3031/3032/3033)
                              │
                              ├──→ Pinecone (HTTPS/443)
                              ├──→ Z.AI API (HTTPS/443)
                              └──→ HuggingFace (HTTPS/443)
```

### Network Listeners

```
Proto    Local Address        PID/Program
─────────────────────────────────────────
tcp      0.0.0.0:3031         2960/python (Medical RAG)
tcp      0.0.0.0:3032         3113/python (LangChain RAG)
tcp      0.0.0.0:3033         4184/python (MedASR)
tcp6     :::3000              340/next-server (Main App)
```

---

## 3. Service Architecture

### 3.1 Main Application (Next.js 16)

**Location:** `/home/z/my-project/`

```
my-project/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes (40+ endpoints)
│   │   ├── page.tsx           # Main Page
│   │   └── layout.tsx         # Root Layout
│   ├── components/            # React Components (40 components)
│   ├── hooks/                 # Custom React Hooks
│   ├── lib/                   # Utilities & Config
│   └── types/                 # TypeScript Types
├── prisma/
│   └── schema.prisma          # Database Schema (30+ models)
├── db/
│   └── custom.db              # SQLite Database
└── mini-services/             # Backend Services
```

**Technology Stack:**
- Framework: Next.js 16.1.1 with App Router
- Language: TypeScript 5
- Database: Prisma ORM + SQLite
- UI: shadcn/ui + Tailwind CSS 4
- State: Zustand + TanStack Query
- Auth: NextAuth.js v4

### 3.2 Medical RAG Service (Port 3031)

**Location:** `/home/z/my-project/mini-services/medical-rag-service/`

```
medical-rag-service/
├── index.py                   # Entry Point
├── app/
│   ├── main.py               # FastAPI Application
│   ├── api/                  # API Routes
│   ├── core/                 # Core Logic
│   ├── embedding/            # Embedding Service
│   ├── etl/                  # ETL Pipelines
│   ├── llm/                  # LLM Integration
│   ├── retrieval/            # Vector Retrieval
│   └── scheduler/            # Sync Scheduler
└── venv/                     # Python Virtual Environment
```

**Capabilities:**
- PubMed/PMC document search
- Vector embeddings with Pinecone
- GLM-4.7-Flash for diagnosis support
- Specialty-based filtering

### 3.3 LangChain RAG Service (Port 3032)

**Location:** `/home/z/my-project/mini-services/langchain-rag-service/`

```
langchain-rag-service/
├── index.py                   # Entry Point
├── app/
│   ├── main.py               # FastAPI Application
│   ├── api/                  # API Routes
│   ├── core/                 # Core Logic
│   ├── embedding/            # Embedding Service
│   ├── llm/                  # LLM Integration
│   ├── retrieval/            # Vector Retrieval
│   └── sync/                 # Smart Sync Engine
└── venv/                     # Python Virtual Environment
```

**Capabilities:**
- READ/WRITE mode for Pinecone
- Smart document synchronization
- Batch document ingestion
- Vector management

### 3.4 MedASR Service (Port 3033)

**Location:** `/home/z/my-project/mini-services/medasr-service/`

```
medasr-service/
├── index.py                   # FastAPI Application
├── requirements.txt          # Dependencies
└── venv/                     # Python Virtual Environment
    └── torch/                # PyTorch 2.10.0+cpu
    └── transformers/         # HuggingFace Transformers
```

**Capabilities:**
- Google MedASR model (4.6% WER)
- Medical term post-processing
- Real-time transcription
- File-based transcription

---

## 4. Traffic Flow

### 4.1 Voice Transcription Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   Browser   │     │  Next.js     │     │    MedASR      │     │  HuggingFace│
│  Microphone │────▶│  API Route   │────▶│    Service     │────▶│   Model     │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────────┘
      │                    │                     │
      │                    │                     │
      │ 1. Audio Blob      │                     │
      │ (WebM/Opus)        │                     │
      │───────────────────▶│                     │
      │                    │ 2. POST /api/       │
      │                    │    medasr/          │
      │                    │    transcribe       │
      │                    │────────────────────▶│
      │                    │                     │ 3. Load Model
      │                    │                     │    (google/medasr)
      │                    │                     │─────────────────▶
      │                    │                     │
      │                    │                     │ 4. Transcribe
      │                    │                     │    (CTC Decode)
      │                    │                     │
      │                    │ 5. JSON Response    │
      │                    │ {transcription,     │
      │                    │  confidence,        │
      │                    │  medical_terms}     │
      │                    │◀────────────────────│
      │ 6. Display Text    │                     │
      │◀───────────────────│                     │
```

### 4.2 RAG Query Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   User      │     │  Next.js     │     │  Medical RAG   │     │  Pinecone   │
│   Query     │────▶│  API Route   │────▶│    Service     │────▶│  Vector DB  │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────────┘
                                                              │
                                                              ▼
                                                        ┌─────────────┐
                                                        │   Z.AI GLM  │
                                                        │  4.7-Flash  │
                                                        └─────────────┘

1. User submits medical query
2. Next.js forwards to Medical RAG (port 3031)
3. RAG Service:
   a. Generates embedding for query
   b. Searches Pinecone for similar documents
   c. Retrieves top-k relevant passages
   d. Constructs prompt with context
   e. Calls GLM-4.7-Flash for generation
4. Returns AI-generated response with sources
```

### 4.3 Patient Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Frontend   │     │  Next.js     │     │   Prisma ORM   │
│  Form Input │────▶│  API Route   │────▶│    SQLite      │
└─────────────┘     └──────────────┘     └────────────────┘

Patient CRUD Operations:
────────────────────────
POST   /api/patients           → Create patient
GET    /api/patients           → List patients
GET    /api/patients/[id]      → Get patient
PUT    /api/patients/[id]      → Update patient
DELETE /api/patients/[id]      → Delete patient

Related Data:
─────────────
GET    /api/patients/[id]/documents     → Patient documents
GET    /api/patients/[id]/medications   → Patient medications
```

### 4.4 Drug Interaction Check Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Doctor    │     │  Drug API    │     │   Knowledge    │
│   Input     │────▶│    Route     │────▶│     Base       │
└─────────────┘     └──────────────┘     └────────────────┘

Drug Interaction Model:
──────────────────────
DrugInteractionKnowledge {
  drug1Name, drug2Name,
  severity: contraindicated|major|moderate|minor|none,
  mechanism, description,
  clinicalEffects[], management
}
```

---

## 5. Database Schema

### 5.1 Core Healthcare Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PATIENT                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Identity:                                                                    │
│   id, bahmniPatientId, mrn, nationalHealthId, patientDigitalId             │
│ Demographics:                                                                │
│   firstName, lastName, dateOfBirth, gender, bloodType                       │
│ Contact:                                                                     │
│   phone, email, address, city, state, country                               │
│ Emergency:                                                                   │
│   emergencyContactName, emergencyContactPhone, allergies                    │
│ AI Fields:                                                                   │
│   aiRiskScore, aiRiskLevel, aiReadmissionRisk, aiMortalityRisk             │
│ Biometrics:                                                                  │
│   fingerprintRegistered, irisScanRegistered, voicePrintRegistered          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Consultation   │  │  Diagnosis      │  │  PatientMed     │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ id              │  │ id              │  │ id              │
│ patientId       │  │ patientId       │  │ patientId       │
│ consultationDate│  │ icdCode         │  │ medicationName  │
│ chiefComplaint  │  │ snomedCode      │  │ dosage          │
│ subjectiveNotes │  │ diagnosisName   │  │ frequency       │
│ objectiveNotes  │  │ severity        │  │ startDate       │
│ assessment      │  │ aiSuggested     │  │ endDate         │
│ plan            │  │ aiConfidence    │  │ interactionAlerts│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 5.2 Lab & Diagnostics

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    LabOrder     │────▶│  LabOrderItem   │     │   LabResult     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ orderNumber     │     │ orderId         │     │ patientId       │
│ patientId       │     │ testName        │     │ orderId         │
│ priority        │     │ testCode        │     │ testName        │
│ status          │     │ category        │     │ resultValue     │
│ clinicalNotes   │     │ resultValue     │     │ interpretation  │
│ sampleCollected │     │ interpretation  │     │ aiInterpretation│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 5.3 AI & Knowledge Base

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KNOWLEDGE BASE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │HealthcareKnowledge│  │DrugInteractionKb │  │ClinicalGuidelineKb│       │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤       │
│  │ title, content    │  │ drug1Name         │  │ title, condition  │       │
│  │ category          │  │ drug2Name         │  │ icdCode           │       │
│  │ embedding (768d)  │  │ severity          │  │ recommendations   │       │
│  │ evidenceLevel     │  │ mechanism         │  │ evidenceLevel     │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │SymptomConditionMap│  │   RAGQuery        │  │ KnowledgeFeedback │       │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤       │
│  │ symptomName       │  │ queryText         │  │ knowledgeId       │       │
│  │ conditions[]      │  │ knowledgeIds[]    │  │ feedbackType      │       │
│  │ sensitivity       │  │ aiResponse        │  │ rating            │       │
│  │ specificity       │  │ wasHelpful        │  │ comment           │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 LLM Integration (SSOT)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LLMIntegration                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Provider Config:                                                            │
│  ────────────────                                                            │
│  provider: zai | openai | gemini | claude | ollama | other                  │
│  displayName: "Z.AI GLM-4.7"                                                 │
│  baseUrl: API endpoint URL (for custom/ollama)                              │
│  apiKey: Encrypted API key                                                   │
│  model: glm-4-flash | gpt-4 | gemini-pro | etc.                            │
│                                                                              │
│  Selection Priority:                                                         │
│  ─────────────────                                                           │
│  isActive: true/false                                                        │
│  isDefault: true/false                                                       │
│  priority: 0-100 (higher = higher priority)                                 │
│                                                                              │
│  Settings (JSON):                                                            │
│  ────────────────                                                            │
│  { temperature, maxTokens, topP, frequencyPenalty, presencePenalty }        │
│                                                                              │
│  Usage Tracking:                                                             │
│  ───────────────                                                             │
│  totalRequests, lastUsed, lastError, connectionStatus                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Reference

### 6.1 Next.js API Routes (40+ Endpoints)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/patients` | GET, POST | Patient CRUD |
| `/api/patients/[id]` | GET, PUT, DELETE | Single patient operations |
| `/api/consultations` | GET, POST | Consultation management |
| `/api/lab-orders` | GET, POST | Lab order management |
| `/api/lab-results` | GET, POST | Lab results |
| `/api/medasr/transcribe` | POST | Voice transcription |
| `/api/asr` | POST | Alternative ASR (z-ai-sdk) |
| `/api/medical-rag` | POST | RAG query proxy |
| `/api/clinical-support` | POST | Clinical decision support |
| `/api/drug-interaction` | POST | Drug interaction check |
| `/api/ai-suggestions` | POST | AI-powered suggestions |
| `/api/tts` | POST | Text-to-speech |
| `/api/image-analysis` | POST | Medical image analysis |
| `/api/llm-integrations` | GET, POST | LLM provider management |
| `/api/smart-patient-identity` | GET, POST | Smart card management |
| `/api/rl` | POST | Reinforcement learning feedback |

### 6.2 Medical RAG Service (Port 3031)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/query` | POST | RAG query |
| `/api/v1/ingest` | POST | Ingest document |
| `/api/v1/diagnose` | POST | Diagnostic suggestions |
| `/api/v1/scheduler/status` | GET | Sync scheduler status |
| `/api/v1/scheduler/sync` | POST | Trigger sync |
| `/api/v1/specialties` | GET | Medical specialties |
| `/api/v1/stats/retrieval` | GET | Retrieval statistics |
| `/api/v1/stats/diagnostic` | GET | Diagnostic statistics |

### 6.3 LangChain RAG Service (Port 3032)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/query` | POST | RAG query |
| `/api/v1/ingest` | POST | Ingest single document |
| `/api/v1/ingest/batch` | POST | Batch document ingestion |
| `/api/v1/vectors/{pmid}` | DELETE | Delete vectors by PMID |
| `/api/v1/sync/status` | GET | Sync status |
| `/api/v1/sync/import` | POST | Import from source |
| `/api/v1/sync/clear` | DELETE | Clear vectors |
| `/api/v1/stats` | GET | Service statistics |
| `/api/v1/specialties` | GET | Medical specialties |

### 6.4 MedASR Service (Port 3033)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/transcribe` | POST | Transcribe base64 audio |
| `/transcribe/file` | POST | Transcribe uploaded file |
| `/transcribe/stream` | POST | Stream transcription |
| `/medical-terms` | GET | Supported medical terms |

**Transcribe Request:**
```json
{
  "audio_base64": "base64-encoded-audio",
  "sample_rate": 16000,
  "language": "en",
  "context": "soap-subjective",
  "enable_medical_postprocess": true
}
```

**Transcribe Response:**
```json
{
  "transcription": "Patient presents with...",
  "confidence": 0.95,
  "word_count": 25,
  "processing_time_ms": 450,
  "medical_terms_detected": ["hypertension", "metformin"],
  "segments": []
}
```

---

## 7. External Integrations

### 7.1 Pinecone (Vector Database)

```
┌─────────────────────────────────────────────────────────────────┐
│                       PINECONE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Index: gelani-medical                                          │
│  Dimensions: 768                                                │
│  Metric: cosine                                                 │
│                                                                 │
│  Namespaces:                                                    │
│  ───────────                                                    │
│  • pubmed - Medical literature (shared)                        │
│  • clinical - Clinical guidelines                               │
│  • drugs - Drug information                                     │
│                                                                 │
│  API Key: pcsk_57cpCV_***                                       │
│  Environment: us-east-1                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Z.AI GLM-4.7-Flash (LLM)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Z.AI GLM-4.7                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Model: glm-4-flash                                             │
│  Provider: zai                                                  │
│                                                                 │
│  Capabilities:                                                  │
│  ────────────                                                   │
│  • Medical text generation                                      │
│  • Diagnosis suggestions                                        │
│  • Clinical decision support                                    │
│  • Document summarization                                       │
│                                                                 │
│  API Key: f631a18af3784849a366b18e513c4ca3                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 HuggingFace (MedASR Model)

```
┌─────────────────────────────────────────────────────────────────┐
│                       HUGGINGFACE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Model: google/medasr                                           │
│  Type: Wav2Vec2 CTC                                             │
│  WER: 4.6% (medical domain)                                     │
│                                                                 │
│  Components:                                                    │
│  ──────────                                                     │
│  • AutoProcessor - Audio preprocessing                         │
│  • Wav2Vec2ForCTC - Speech recognition model                   │
│                                                                 │
│  API Key: YOUR_HUGGINGFACE_TOKEN_HERE                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 NCBI/PubMed (Medical Literature)

```
┌─────────────────────────────────────────────────────────────────┐
│                       NCBI/PUBMED                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  API: Entrez E-utilities                                        │
│  Database: PubMed, PMC                                          │
│                                                                 │
│  API Key: 25b0fc18f6507e7190c88bd59aaf1a6c                      │
│                                                                 │
│  Usage:                                                         │
│  ───────                                                        │
│  • Search medical literature                                    │
│  • Retrieve abstracts and full text                             │
│  • ETL pipeline for knowledge base                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Frontend Architecture

### 8.1 Component Structure

```
src/components/
├── ui/                          # shadcn/ui Components (40+)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   └── ...
│
├── Core Modules/
│   ├── patient-management.tsx          # Patient CRUD
│   ├── consultation-module.tsx         # SOAP Notes
│   ├── lab-module.tsx                  # Lab Management
│   └── clinical-decision-support.tsx   # AI Assistant
│
├── AI Features/
│   ├── advanced-ai-intelligence.tsx    # AI Dashboard
│   ├── ai-model-selector.tsx           # LLM Provider Selector
│   ├── drug-interaction-checker.tsx    # Drug Checking
│   └── image-analysis.tsx              # Medical Imaging
│
├── Voice/
│   ├── medasr-input.tsx                # Voice Input Component
│   ├── floating-voice-input.tsx        # Floating Voice Button
│   └── clinical-voice-recorder.tsx     # Clinical Recording
│
└── Integration/
    ├── bahmni-integration.tsx          # Bahmni EMR
    ├── enhanced-integrations.tsx       # External Systems
    └── knowledge-base-management.tsx   # Knowledge Base
```

### 8.2 State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                     STATE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Server State (TanStack Query):                                 │
│  ───────────────────────────                                    │
│  • Patient data                                                 │
│  • Consultations                                                │
│  • Lab results                                                  │
│  • AI interactions                                              │
│                                                                 │
│  Client State (Zustand):                                        │
│  ──────────────────────                                         │
│  • UI preferences                                               │
│  • Form state                                                   │
│  • Session data                                                 │
│                                                                 │
│  Form State (React Hook Form):                                  │
│  ─────────────────────────                                      │
│  • Patient registration                                         │
│  • Consultation notes                                           │
│  • Lab order forms                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Custom Hooks

```
src/hooks/
├── use-medasr.ts          # Voice recording & transcription
├── use-toast.ts           # Toast notifications
├── use-medical-rag.ts     # RAG query integration
└── use-patients.ts        # Patient data fetching
```

---

## 9. Persistence System

### 9.1 Supervisor Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /home/z/services-supervisor.sh                                 │
│  ────────────────────────────────                               │
│  • Monitors ports 3031, 3032, 3033                              │
│  • Checks every 30 seconds                                      │
│  • Auto-restarts crashed services                               │
│  • Logs to /home/z/logs/supervisor.log                          │
│                                                                 │
│  /home/z/gelani-control.sh                                      │
│  ─────────────────────────                                       │
│  • Interactive control menu                                     │
│  • start/stop/restart/status commands                           │
│  • Health check integration                                     │
│  • Log viewing                                                  │
│                                                                 │
│  Auto-Start Mechanisms:                                         │
│  ───────────────────────                                        │
│  • .bashrc - Interactive shell auto-start                       │
│  • .profile - Login shell auto-start                            │
│  • Marker files prevent duplicate starts                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Service Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICE LIFECYCLE                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Boot/Splash Screen                                               │
│        │                                                         │
│        ▼                                                         │
│  ┌─────────────────┐                                             │
│  │ Check Marker    │───────▶ Marker exists? ──────▶ Skip start  │
│  │ File            │              │ No                           │
│  └─────────────────┘              ▼                              │
│                          ┌─────────────────┐                     │
│                          │ Start Services  │                     │
│                          │ • Medical RAG   │                     │
│                          │ • LangChain RAG │                     │
│                          │ • MedASR        │                     │
│                          └────────┬────────┘                     │
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                     │
│                          │ Start Supervisor│                     │
│                          │ (background)    │                     │
│                          └────────┬────────┘                     │
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                     │
│                          │ Create Marker   │                     │
│                          │ File            │                     │
│                          └─────────────────┘                     │
│                                                                  │
│  Runtime Monitoring (Supervisor Loop):                           │
│  ───────────────────────────────────                             │
│  while true:                                                     │
│    for each service:                                             │
│      if port not listening:                                      │
│        restart service                                           │
│    sleep 30 seconds                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.3 File Locations

```
/home/z/
├── services-supervisor.sh    # Main supervisor script
├── gelani-control.sh         # Control script
├── gelani-init.sh            # Initialization script
├── GELANI_STATE.md           # State documentation
├── GELANI_ARCHITECTURE.md    # This document
├── logs/                     # Log files
│   ├── medical-rag.log
│   ├── langchain-rag.log
│   ├── medasr.log
│   ├── supervisor.log
│   └── supervisor-bg.log
├── pids/                     # PID files
│   ├── medical-rag.pid
│   ├── langchain-rag.pid
│   └── medasr.pid
└── .gelani_auto_started      # Marker file
```

---

## 10. Security & Configuration

### 10.1 API Keys Management

| Service | Key Name | Storage | Usage |
|---------|----------|---------|-------|
| Z.AI | API Key | Database (LLMIntegration) | LLM inference |
| Pinecone | API Key | Service config | Vector DB |
| HuggingFace | HF_API_KEY | Environment | MedASR model |
| NCBI | API Key | Service config | PubMed access |

### 10.2 Environment Variables

```bash
# Main Application (.env)
DATABASE_URL=file:/home/z/my-project/db/custom.db

# MedASR Service
PORT=3033
HF_API_KEY=YOUR_HUGGINGFACE_TOKEN_HERE
MEDASR_MODEL=google/medasr

# Medical RAG Service
PORT=3031
LOG_LEVEL=info

# LangChain RAG Service
PORT=3032
```

### 10.3 Network Security

```
┌─────────────────────────────────────────────────────────────────┐
│                     NETWORK SECURITY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  External Access:                                               │
│  ────────────────                                               │
│  • Only port 80/443 exposed via Caddy                           │
│  • All internal services (3031-3033) not directly accessible   │
│                                                                 │
│  Gateway Rules:                                                 │
│  ──────────────                                                 │
│  • XTransformPort required for direct service access           │
│  • CORS enabled for all origins (development)                   │
│  • No authentication on internal services (trust boundary)      │
│                                                                 │
│  Future Production:                                             │
│  ─────────────────                                               │
│  • Add authentication layer                                     │
│  • Enable HTTPS with valid certificates                         │
│  • Restrict CORS to known origins                               │
│  • Add rate limiting                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Quick Reference Commands

```bash
# Service Management
gelani                    # Interactive control menu
gelani-status             # Quick status check
bash /home/z/services-supervisor.sh start    # Start all
bash /home/z/services-supervisor.sh stop     # Stop all
bash /home/z/services-supervisor.sh restart  # Restart all

# Health Checks
curl http://localhost:3031/health   # Medical RAG
curl http://localhost:3032/health   # LangChain RAG
curl http://localhost:3033/health   # MedASR
curl http://localhost:3000/api/medasr/transcribe  # Via Next.js

# Logs
tail -f /home/z/logs/*.log          # All logs
tail -f /home/z/my-project/dev.log  # Next.js dev log

# Database
sqlite3 /home/z/my-project/prisma/dev.db ".tables"
bun run db:push                     # Update schema
```

---

## Appendix B: Dependencies

### Frontend (package.json)

- next: ^16.1.1
- react: ^19.0.0
- @prisma/client: ^6.11.1
- @radix-ui/*: (40+ components)
- tailwindcss: (via @tailwindcss/postcss)
- framer-motion: ^12.23.2
- @tanstack/react-query: ^5.82.0
- lucide-react: ^0.525.0

### Backend Services (requirements.txt)

- fastapi
- uvicorn
- pinecone-client
- torch (2.10.0+cpu)
- transformers
- librosa
- soundfile
- python-dotenv
- loguru

---

**Document Version:** 1.0.0
**Last Updated:** March 17, 2026
**Author:** Gelani AI System
