# s6-overlay Container Process Management

This document describes the s6-overlay implementation for the Gelani Healthcare Platform, providing proper PID 1, zombie reaping, automatic restart, dependency ordering, and graceful shutdown.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Gelani Unified Container                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    s6-overlay (PID 1)                                │    │
│  │  • Proper init process                                               │    │
│  │  • Zombie reaping                                                    │    │
│  │  • Service supervision                                               │    │
│  │  • Graceful shutdown cascade                                         │    │
│  │  • ~1MB memory overhead                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LAYER 1: Initialization                           │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ init-first (oneshot)                                         │    │    │
│  │  │ • Database setup and migrations                              │    │    │
│  │  │ • Environment configuration                                  │    │    │
│  │  │ • Directory creation                                         │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LAYER 2: Backend Services (Standalone)           │    │
│  │                                                                      │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │    │
│  │  │   MedASR     │    │ Medical RAG  │    │              │          │    │
│  │  │    :3033     │    │    :3031     │    │              │          │    │
│  │  │ (Standalone) │    │ (Standalone) │    │              │          │    │
│  │  │              │    │              │    │              │          │    │
│  │  │ External:    │    │ External:    │    │              │          │    │
│  │  │ • HuggingFace│    │ • Pinecone   │    │              │          │    │
│  │  │              │    │ • NCBI/PubMed│    │              │          │    │
│  │  │              │    │ • Z.AI LLM   │    │              │          │    │
│  │  └──────────────┘    └──────┬───────┘    └──────────────┘          │    │
│  └─────────────────────────────┼───────────────────────────────────────┘    │
│                                │                                             │
│  ┌─────────────────────────────┼───────────────────────────────────────┐    │
│  │                    LAYER 3: Dependent Services                       │    │
│  │                            │                                         │    │
│  │  ┌─────────────────────────▼───────────────────────────┐            │    │
│  │  │                 LangChain RAG                        │            │    │
│  │  │                     :3032                            │            │    │
│  │  │                                                      │            │    │
│  │  │  Dependencies: Medical RAG (for sync/hybrid queries) │            │    │
│  │  │  External: Pinecone, Z.AI LLM                        │            │    │
│  │  └──────────────────────────────────────────────────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┼───────────────────────────────────┐    │
│  │                    LAYER 4: Application Layer                        │    │
│  │                                  │                                   │    │
│  │  ┌───────────────────────────────▼───────────────────────────────┐  │    │
│  │  │                     Next.js Application                        │  │    │
│  │  │                         Port 3000                              │  │    │
│  │  │                                                                │  │    │
│  │  │  Dependencies:                                                 │  │    │
│  │  │  • Medical RAG (:3031) - PubMed queries                        │  │    │
│  │  │  • LangChain RAG (:3032) - Document RAG                        │  │    │
│  │  │  • MedASR (:3033) - Speech recognition                         │  │    │
│  │  │                                                                │  │    │
│  │  │  External: Z.AI LLM (clinical support), SQLite                 │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┼───────────────────────────────────┐    │
│  │                    LAYER 5: Edge Layer                               │    │
│  │                                  │                                   │    │
│  │  ┌───────────────────────────────▼───────────────────────────────┐  │    │
│  │  │                        Caddy                                   │  │    │
│  │  │                    Ports 80, 443                               │  │    │
│  │  │                                                                │  │    │
│  │  │  Dependencies: Next.js (:3000)                                 │  │    │
│  │  │  Role: Reverse proxy, HTTPS termination, load balancing        │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Tree

```
/etc/s6-overlay/s6-rc.d/
├── init-first/                    # LAYER 1: Initialization
│   ├── type                       → "oneshot"
│   └── up                         → Database init, env setup
│
├── medasr/                        # LAYER 2: Standalone service
│   ├── type                       → "longrun"
│   ├── dependencies.d/
│   │   └── init-first
│   ├── run                        → Start MedASR service
│   └── finish                     → Cleanup on shutdown
│
├── medical-rag/                   # LAYER 2: Standalone service
│   ├── type                       → "longrun"
│   ├── dependencies.d/
│   │   └── init-first             # Only external deps (Pinecone, NCBI, Z.AI)
│   ├── run                        → Start Medical RAG service
│   └── finish                     → Cleanup on shutdown
│
├── langchain-rag/                 # LAYER 3: Depends on Medical RAG
│   ├── type                       → "longrun"
│   ├── dependencies.d/
│   │   ├── init-first
│   │   └── medical-rag            # Must start after Medical RAG
│   ├── run                        → Start LangChain RAG service
│   └── finish                     → Cleanup on shutdown
│
├── nextjs/                        # LAYER 4: Depends on all backends
│   ├── type                       → "longrun"
│   ├── dependencies.d/
│   │   ├── init-first
│   │   ├── medasr                 # Speech recognition backend
│   │   ├── medical-rag            # Primary RAG backend
│   │   └── langchain-rag          # Secondary RAG backend
│   ├── run                        → Start Next.js application
│   └── finish                     → Cleanup on shutdown
│
├── caddy/                         # LAYER 5: Depends on Next.js
│   ├── type                       → "longrun"
│   ├── dependencies.d/
│   │   ├── init-first
│   │   └── nextjs                 # Proxies to Next.js
│   ├── run                        → Start Caddy reverse proxy
│   └── finish                     → Cleanup on shutdown
│
└── user/
    └── contents.d/                # Services to start on boot
        ├── init-first
        ├── medasr
        ├── medical-rag
        ├── langchain-rag
        ├── nextjs
        └── caddy
```

## Services

### Layer 1: Initialization

| Service | Type | Port | Dependencies | Description |
|---------|------|------|--------------|-------------|
| init-first | oneshot | - | None | Database migrations, env setup |

### Layer 2: Backend Services (Standalone)

| Service | Type | Port | Dependencies | External Dependencies |
|---------|------|------|--------------|----------------------|
| MedASR | longrun | 3033 | init-first | HuggingFace (optional) |
| Medical RAG | longrun | 3031 | init-first | Pinecone, NCBI/PubMed, Z.AI |

**Why these are standalone:**
- MedASR: Only uses local Whisper model, no internal service calls
- Medical RAG: Only calls external APIs (Pinecone, NCBI, Z.AI), never calls Next.js

### Layer 3: Dependent Services

| Service | Type | Port | Dependencies | Reason |
|---------|------|------|--------------|--------|
| LangChain RAG | longrun | 3032 | init-first, medical-rag | Calls Medical RAG for hybrid/sync operations |

**Dependency reasoning:**
LangChain RAG calls Medical RAG for:
- `/api/v1/hybrid/sync-from-pinecone` - BM25 index sync
- `/api/v1/hybrid/stats` - Hybrid retrieval statistics
- `/api/v1/hybrid-query` - Hybrid query proxy

### Layer 4: Application Layer

| Service | Type | Port | Dependencies | Description |
|---------|------|------|--------------|-------------|
| Next.js | longrun | 3000 | init-first, medasr, medical-rag, langchain-rag | Main healthcare app |

**Dependency reasoning:**
Next.js acts as an API gateway and calls all backend services:
- Medical RAG (`:3031`) - PubMed literature queries
- LangChain RAG (`:3032`) - Document RAG operations
- MedASR (`:3033`) - Speech-to-text transcription

### Layer 5: Edge Layer

| Service | Type | Port | Dependencies | Description |
|---------|------|------|--------------|-------------|
| Caddy | longrun | 80, 443 | init-first, nextjs | Reverse proxy |

## Startup Order

The actual startup order resolved by s6-overlay:

```
1. init-first          → Database/env setup (oneshot, blocks others)
   │
   ├─► 2a. medasr      → Starts in parallel with 2b (no cross-dependency)
   └─► 2b. medical-rag → Starts in parallel with 2a (no cross-dependency)
          │
          └─► 3. langchain-rag → Waits for medical-rag
                  │
                  └─► 4. nextjs → Waits for all backends
                          │
                          └─► 5. caddy → Waits for nextjs
```

**Startup timing:**
- Layer 1: ~5 seconds (database setup)
- Layer 2: ~30 seconds (model loading)
- Layer 3: ~10 seconds (service init)
- Layer 4: ~15 seconds (Next.js startup)
- Layer 5: ~2 seconds (Caddy config)

**Total startup time:** ~60 seconds

## Usage

### Build the Container
```bash
# Build with s6-overlay
docker build -f Dockerfile.s6 -t gelani-unified:latest .

# Or use docker compose
docker compose -f docker-compose.s6.yml build
```

### Run the Container
```bash
# Run with docker compose
docker compose -f docker-compose.s6.yml up -d

# View logs (all services)
docker compose -f docker-compose.s6.yml logs -f

# View specific service logs
docker exec gelani-unified cat /var/log/medical-rag/current
```

### Service Management Commands
```bash
# Check service status
docker exec gelani-unified s6-svstat /run/service/medasr
docker exec gelani-unified s6-svstat /run/service/medical-rag
docker exec gelani-unified s6-svstat /run/service/langchain-rag
docker exec gelani-unified s6-svstat /run/service/nextjs
docker exec gelani-unified s6-svstat /run/service/caddy

# Restart a service (dependencies maintained)
docker exec gelani-unified s6-svc -r /run/service/medical-rag

# Stop a service
docker exec gelani-unified s6-svc -d /run/service/medical-rag

# Start a service
docker exec gelani-unified s6-svc -u /run/service/medical-rag

# List all services
docker exec gelani-unified s6-svls /run/service
```

### Health Checks
```bash
# Check each service health endpoint
curl http://localhost:3033/health  # MedASR
curl http://localhost:3031/health  # Medical RAG
curl http://localhost:3032/health  # LangChain RAG
curl http://localhost:3000/api/health  # Next.js
```

### Graceful Shutdown
```bash
# s6-overlay handles graceful shutdown automatically
docker compose -f docker-compose.s6.yml down

# The shutdown cascade (reverse of startup):
# 1. SIGTERM sent to PID 1 (s6-overlay)
# 2. Caddy stops first (no dependents)
# 3. Next.js stops
# 4. LangChain RAG stops
# 5. Medical RAG and MedASR stop (parallel)
# 6. init-first cleanup
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Proper PID 1** | s6-overlay acts as init, handling signals correctly |
| **Zombie Reaping** | Automatically reaps zombie processes |
| **Automatic Restart** | Services restart on crash with backoff |
| **Dependency Ordering** | Services start in correct order based on dependencies |
| **Graceful Shutdown** | Clean shutdown cascade in reverse dependency order |
| **Low Overhead** | ~1MB memory overhead for process supervision |
| **Logging** | Centralized logging with timestamps |
| **Health Checks** | Built-in health check support |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node.js environment |
| `PORT` | 3000 | Next.js port |
| `MEDICAL_RAG_PORT` | 3031 | Medical RAG service port |
| `LANGCHAIN_RAG_PORT` | 3032 | LangChain RAG service port |
| `MEDASR_PORT` | 3033 | MedASR service port |
| `DATABASE_URL` | file:/app/data/healthcare.db | Database connection |
| `PINECONE_API_KEY` | - | Pinecone vector DB API key |
| `ZAI_API_KEY` | - | Z.AI LLM API key |
| `NCBI_API_KEY` | - | NCBI PubMed API key |
| `HF_TOKEN` | - | HuggingFace token (for models) |
| `S6_KEEP_ENV` | 1 | Keep environment in s6 |
| `S6_CMD_WAIT_FOR_SERVICES_MAXTIME` | 0 | No timeout for startup |

## Troubleshooting

### Service Not Starting
```bash
# Check service status and logs
docker exec gelani-unified s6-svstat /run/service/medical-rag

# Check if dependencies are ready
docker exec gelani-unified curl -s http://localhost:3031/health

# Manual start for debugging
docker exec -it gelani-unified /bin/sh
cd /app/mini-services/medical-rag-service
uvicorn app.main:app --host 0.0.0.0 --port 3031
```

### Dependency Issues
```bash
# View resolved dependency order
docker exec gelani-unified s6-rc-db listall

# Check if a service is waiting for dependency
docker exec gelani-unified s6-svstat /run/service/nextjs
```

### Permission Issues
```bash
# Ensure scripts are executable
docker exec gelani-unified chmod +x /etc/s6-overlay/s6-rc.d/*/run
docker exec gelani-unified chmod +x /etc/s6-overlay/s6-rc.d/*/finish
docker exec gelani-unified chmod +x /etc/s6-overlay/s6-rc.d/*/up
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile.s6` | Docker image with s6-overlay |
| `docker-compose.s6.yml` | Docker Compose configuration |
| `s6-overlay/s6-rc.d/*/type` | Service type definition |
| `s6-overlay/s6-rc.d/*/run` | Service start script |
| `s6-overlay/s6-rc.d/*/finish` | Service cleanup script |
| `s6-overlay/s6-rc.d/*/up` | Oneshot execution script |
| `s6-overlay/s6-rc.d/*/dependencies.d/*` | Service dependencies |
| `s6-overlay/s6-rc.d/user/contents.d/*` | Services to start on boot |
| `Caddyfile` | Caddy reverse proxy configuration |

## Call Flow Reference

```
External Request
       │
       ▼
    Caddy (:80/:443)
       │
       ▼
    Next.js (:3000)
       │
       ├──► Medical RAG (:3031) ──► Pinecone, NCBI, Z.AI
       │
       ├──► LangChain RAG (:3032) ──► Medical RAG (:3031), Pinecone, Z.AI
       │
       └──► MedASR (:3033) ──► Local Whisper Model
```

**Key insight:** Next.js is the **client** for all RAG services. The RAG services do NOT depend on Next.js - they are standalone backend services that Next.js calls.
