/**
 * Gelani Mini-Services Starter - Z.ai SDK Integration
 * =====================================================
 * Starts all RAG and ASR services using Bun + Z.ai SDK
 * 
 * Usage: bun run start-services.ts
 * 
 * Services:
 *   - Medical RAG (3031) - Real AI diagnostics
 *   - LangChain RAG (3032) - Knowledge base management
 *   - MedASR (3033) - Real speech-to-text
 */

import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";

const services = [
  { name: "Medical RAG", port: 3031, script: "mini-services/medical-rag-service.ts" },
  { name: "LangChain RAG", port: 3032, script: "mini-services/langchain-rag-service.ts" },
  { name: "MedASR", port: 3033, script: "mini-services/medasr-service.ts" },
];

const processes: ChildProcess[] = [];
let isShuttingDown = false;

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   Gelani Mini-Services - Z.ai SDK Integration              ║");
console.log("║   Real AI-Powered Clinical Decision Support                ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");

// Check if scripts exist
for (const service of services) {
  if (!existsSync(service.script)) {
    console.error(`❌ Error: ${service.script} not found`);
    process.exit(1);
  }
}

// Check for z-ai-web-dev-sdk
try {
  require.resolve('z-ai-web-dev-sdk');
  console.log("✅ z-ai-web-dev-sdk found");
} catch {
  console.error("❌ z-ai-web-dev-sdk not found. Run: bun install");
  process.exit(1);
}

// Start services
console.log("\n📦 Starting services...\n");

for (const service of services) {
  console.log(`  Starting ${service.name} on port ${service.port}...`);
  
  const proc = spawn("bun", ["run", service.script], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { 
      ...process.env, 
      PORT: String(service.port),
      NODE_ENV: process.env.NODE_ENV || "development"
    },
  });
  
  proc.stdout?.on("data", (data) => {
    const output = data.toString().trim();
    if (output && !isShuttingDown) {
      console.log(`  [${service.name}] ${output}`);
    }
  });
  
  proc.stderr?.on("data", (data) => {
    const output = data.toString().trim();
    if (output && !isShuttingDown) {
      console.error(`  [${service.name}] ${output}`);
    }
  });

  proc.on("close", (code) => {
    if (!isShuttingDown) {
      console.log(`  [${service.name}] Process exited with code ${code}`);
    }
  });
  
  processes.push(proc);
}

// Wait for services to start then check health
setTimeout(async () => {
  console.log("\n🔍 Checking service health...\n");
  
  let allHealthy = true;
  for (const service of services) {
    try {
      const response = await fetch(`http://localhost:${service.port}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      const status = data.status === "healthy" ? "✅ healthy" : "❌ unhealthy";
      console.log(`  ${service.name} (Port ${service.port}): ${status}`);
      if (data.status !== "healthy") allHealthy = false;
    } catch (error) {
      console.log(`  ${service.name} (Port ${service.port}): ❌ not responding`);
      allHealthy = false;
    }
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    SERVICE URLs                            ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  Medical RAG API:   http://localhost:3031                  ║");
  console.log("║  LangChain RAG API: http://localhost:3032                  ║");
  console.log("║  MedASR API:        http://localhost:3033                  ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  Main Application:  http://localhost:3000                  ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  All services use Z.ai SDK for real AI capabilities       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  if (allHealthy) {
    console.log("\n✨ All services running with real AI capabilities!");
  } else {
    console.log("\n⚠️  Some services may need attention. Check logs above.");
  }
  
  console.log("\n  Press Ctrl+C to stop all services.\n");
}, 3000);

// Handle shutdown gracefully
function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n\n🛑 Received ${signal}. Stopping all services...`);
  
  for (const proc of processes) {
    try {
      proc.kill("SIGTERM");
    } catch (e) {
      // Ignore kill errors
    }
  }
  
  setTimeout(() => {
    console.log("✅ All services stopped.");
    process.exit(0);
  }, 1000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", () => {
  for (const proc of processes) {
    try {
      proc.kill();
    } catch (e) {
      // Ignore
    }
  }
});
