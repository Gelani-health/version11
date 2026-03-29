#!/usr/bin/env python3
"""
Medical Diagnostic RAG Service Entry Point
==========================================

Run this service with: bun run index.py
or: python index.py
"""

import os
import sys
import subprocess

# Ensure dependencies are installed
def check_dependencies():
    """Check if required packages are installed."""
    required = [
        "fastapi",
        "uvicorn",
        "pinecone",
        "httpx",
        "loguru",
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"Missing dependencies: {', '.join(missing)}")
        print("Installing...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )


if __name__ == "__main__":
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Check and install dependencies
    check_dependencies()
    
    # Load environment
    from dotenv import load_dotenv
    load_dotenv()
    
    # Get configuration
    port = int(os.getenv("PORT", "3031"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     Medical Diagnostic RAG Service                         ║
    ║                                                            ║
    ║     PubMed/PMC + Pinecone + GLM-4.7-Flash                  ║
    ║                                                            ║
    ║     Port: {port}                                              ║
    ║     Docs: http://localhost:{port}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    # Run uvicorn
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level=log_level,
    )
