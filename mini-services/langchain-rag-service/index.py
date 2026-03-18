#!/usr/bin/env python3
"""
LangChain RAG Service Entry Point
==================================

READ/WRITE enabled service with Smart Sync.
Shares Pinecone namespace (pubmed) with Custom RAG.

Usage:
    python index.py
    uvicorn index:app --host 0.0.0.0 --port 3032
"""

import uvicorn
from app.core.config import get_settings
from app.main import app


def print_banner():
    """Print startup banner."""
    settings = get_settings()
    print(f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██████╗  █████╗ ██╗     ██╗     ███████╗ ██████╗ ██╗   ██╗ █████╗         ║
║   ██╔══██╗██╔══██╗██║     ██║     ██╔════╝██╔════╝ ██║   ██║██╔══██╗        ║
║   ██████╔╝███████║██║     ██║     ███████╗██║  ███╗██║   ██║███████║        ║
║   ██╔══██╗██╔══██║██║     ██║     ╚════██║██║   ██║██║   ██║██╔══██║        ║
║   ██████╔╝██║  ██║███████╗███████╗███████║╚██████╔╝╚██████╔╝██║  ██║        ║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝        ║
║                                                                              ║
║   ████████ ██████   █████  ██████  ████████                                 ║
║      ██    ██   ██ ██   ██ ██   ██ ██                                        ║
║      ██    ██████  ███████ ██████  ██████                                    ║
║      ██    ██      ██   ██ ██   ██ ██                                        ║
║      ██    ██      ██   ██ ██   ██ ████████                                 ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   📊 SERVICE STATUS                                                          ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Mode:     READ/WRITE ✅                                                    ║
║   Port:     {settings.PORT:<10}                                                        ║
║   Docs:     http://localhost:{settings.PORT}/docs                                    ║
║                                                                              ║
║   🗄️  NAMESPACE: {settings.PINECONE_NAMESPACE:<10} (SHARED with Custom RAG)                        ║
║   🔑 PREFIX:     {settings.VECTOR_ID_PREFIX:<10} (e.g., lc_pmid_123_chunk_0)                        ║
║   📌 SOURCE:     {settings.SOURCE_PIPELINE:<10}                                             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    settings = get_settings()
    print_banner()

    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
