# Gelani AI Healthcare Assistant - System State

**Last Updated:** 2026-03-17 15:37:20

## Services Status

| Service | Port | Status | PID | Log File |
|---------|------|--------|-----|----------|
| Medical RAG | 3031 | RUNNING | Check with `gelani-status` | /home/z/logs/medical-rag.log |
| LangChain RAG | 3032 | RUNNING | Check with `gelani-status` | /home/z/logs/langchain-rag.log |
| MedASR | 3033 | RUNNING | Check with `gelani-status` | /home/z/logs/medasr.log |
| Main App | 3000 | RUNNING | Auto-managed | /home/z/my-project/dev.log |

## Management Commands

```bash
# Quick status check
gelani-status
# or
bash /home/z/services-supervisor.sh status

# Start all services
bash /home/z/services-supervisor.sh start

# Stop all services
bash /home/z/services-supervisor.sh stop

# Restart all services
bash /home/z/services-supervisor.sh restart

# Interactive control menu
gelani
# or
bash /home/z/gelani-control.sh

# Health check
bash /home/z/gelani-control.sh health

# View logs
tail -f /home/z/logs/*.log
```

## Persistence Configuration

### Auto-Start Mechanisms

1. **Bashrc Auto-Start** (`/home/z/.bashrc`)
   - Triggers on new shell session
   - Creates marker file `/home/z/.gelani_auto_started`
   - Starts all services and supervisor

2. **Profile Auto-Start** (`/home/z/.profile`)
   - Triggers on login shell
   - Ensures services start on SSH/login

3. **Background Supervisor**
   - Monitors services every 30 seconds
   - Auto-restarts crashed services
   - Logs to `/home/z/logs/supervisor.log`

## File Locations

```
/home/z/
├── services-supervisor.sh    # Main supervisor script
├── gelani-control.sh         # Interactive control script
├── gelani-init.sh            # System initialization script
├── logs/                     # All service logs
│   ├── medical-rag.log
│   ├── langchain-rag.log
│   ├── medasr.log
│   ├── supervisor.log
│   └── supervisor-bg.log
├── pids/                     # PID files
│   ├── medical-rag.pid
│   ├── langchain-rag.pid
│   ├── medasr.pid
│   └── supervisor.pid
└── my-project/               # Main Next.js application
    └── mini-services/
        ├── medical-rag-service/
        ├── langchain-rag-service/
        └── medasr-service/
```

## API Keys

| Service | Key Location | Purpose |
|---------|-------------|---------|
| Z.AI (GLM-4.7) | Database (LLMIntegration) | LLM Inference |
| Pinecone | Service config | Vector Database |
| NCBI/PubMed | Service config | Medical Literature |
| HuggingFace | HF_API_KEY env | MedASR Model |

## Troubleshooting

### Service won't start
```bash
# Check logs
tail -100 /home/z/logs/<service>.log

# Manual start
cd /home/z/my-project/mini-services/<service>-service
source venv/bin/activate
python index.py
```

### Port already in use
```bash
# Find process using port
netstat -tlnp | grep <port>

# Kill process
kill -9 <PID>
```

### Reset all services
```bash
# Stop all
bash /home/z/services-supervisor.sh stop

# Remove marker files
rm -f /home/z/.gelani_auto_started /home/z/.gelani_initialized

# Start fresh
bash /home/z/gelani-init.sh
```
