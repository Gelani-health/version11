#!/usr/bin/env python3
"""
Gelani Services Launcher
========================

Starts all mini-services with full ML functionality:
- Medical RAG Service (Port 3031)
- LangChain RAG Service (Port 3032)
- MedASR Service (Port 3033)

Usage:
    python start_services.py [--stub] [--detach]

Options:
    --stub      Use lightweight stub services (faster startup)
    --detach    Run services in background
"""

import os
import sys
import subprocess
import time
import signal
import argparse
from pathlib import Path

# Service configurations
SERVICES = {
    "medical_rag": {
        "port": 3031,
        "name": "Medical RAG Service",
        "stub_file": "stub_medical_rag.py",
        "full_file": "medical_rag_full.py",
        "health_endpoint": "http://localhost:3031/health"
    },
    "langchain_rag": {
        "port": 3032,
        "name": "LangChain RAG Service",
        "stub_file": "stub_langchain_rag.py",
        "full_file": "langchain_rag_full.py",
        "health_endpoint": "http://localhost:3032/health"
    },
    "medasr": {
        "port": 3033,
        "name": "MedASR Service",
        "stub_file": "stub_medasr.py",
        "full_file": "medasr_full.py",
        "health_endpoint": "http://localhost:3033/health"
    }
}

processes = []

def start_service(service_key: str, use_stub: bool = False):
    """Start a single service"""
    service = SERVICES[service_key]
    script_dir = Path(__file__).parent
    
    # Choose stub or full version
    script_file = service["stub_file"] if use_stub else service["full_file"]
    script_path = script_dir / script_file
    
    if not script_path.exists():
        print(f"  ⚠️  Script not found: {script_path}")
        return None
    
    env = os.environ.copy()
    env["PORT"] = str(service["port"])
    
    print(f"  Starting {service['name']} on port {service['port']}...")
    
    process = subprocess.Popen(
        [sys.executable, str(script_path)],
        cwd=str(script_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    process.service_key = service_key
    process.service_name = service["name"]
    process.port = service["port"]
    
    return process

def check_health(service_key: str, timeout: int = 30):
    """Check if service is healthy"""
    import urllib.request
    import urllib.error
    
    service = SERVICES[service_key]
    url = service["health_endpoint"]
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return True
        except:
            pass
        time.sleep(1)
    
    return False

def cleanup(signum=None, frame=None):
    """Clean up all running processes"""
    print("\n🛑 Stopping all services...")
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
            print(f"  ✓ Stopped {process.service_name}")
        except:
            try:
                process.kill()
                print(f"  ✓ Killed {process.service_name}")
            except:
                pass
    sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="Gelani Services Launcher")
    parser.add_argument("--stub", action="store_true", help="Use stub services")
    parser.add_argument("--detach", action="store_true", help="Run in background")
    args = parser.parse_args()
    
    print("=" * 60)
    print("🏥 Gelani Services Launcher")
    print("=" * 60)
    
    mode = "stub (lightweight)" if args.stub else "full (ML-enabled)"
    print(f"Mode: {mode}")
    print("-" * 60)
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Start all services
    print("\n📦 Starting Services:")
    
    for service_key in SERVICES:
        process = start_service(service_key, use_stub=args.stub)
        if process:
            processes.append(process)
    
    # Wait for services to start
    print("\n⏳ Waiting for services to be ready...")
    time.sleep(3)
    
    # Check health
    print("\n🔍 Checking Service Health:")
    all_healthy = True
    for service_key in SERVICES:
        service = SERVICES[service_key]
        healthy = check_health(service_key, timeout=30)
        status = "✅ healthy" if healthy else "❌ unhealthy"
        print(f"  {service['name']} (Port {service['port']}): {status}")
        if not healthy:
            all_healthy = False
    
    # Summary
    print("\n" + "=" * 60)
    if all_healthy:
        print("✅ All services are running!")
    else:
        print("⚠️  Some services may not be fully operational")
    
    print("\n📡 Service URLs:")
    for service_key, service in SERVICES.items():
        print(f"  • {service['name']}: http://localhost:{service['port']}")
        print(f"    API Docs: http://localhost:{service['port']}/docs")
    
    print("\n🌐 Main Application:")
    print("  • Gelani Healthcare: http://localhost:3000")
    
    if args.detach:
        print("\n✨ Services running in background. Press Ctrl+C to stop.")
        print("   PIDs saved to: /tmp/gelani_services.pids")
        # Save PIDs
        with open("/tmp/gelani_services.pids", "w") as f:
            for process in processes:
                f.write(f"{process.pid}\n")
        # Keep running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            cleanup()
    else:
        print("\n✨ Press Ctrl+C to stop all services")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            cleanup()

if __name__ == "__main__":
    main()
