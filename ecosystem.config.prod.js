/**
 * PM2 Ecosystem Configuration for Gelani Healthcare - PRODUCTION
 * ===============================================================
 * 
 * Production configuration WITHOUT hot reload:
 * - Main Next.js Application (3000)
 * - Medical RAG Service (3031)
 * - LangChain RAG Service (3032)
 * - MedASR Voice Service (3033)
 * 
 * Usage:
 *   npx pm2 start ecosystem.config.prod.js --env production
 *   npx pm2 list
 *   npx pm2 logs
 *   npx pm2 stop all
 *   npx pm2 reload all    (graceful reload)
 *   npx pm2 save
 * 
 * Production Features:
 *   - No watch mode (stable)
 *   - More restarts allowed
 *   - Production environment variables
 *   - Graceful shutdown support
 */

module.exports = {
  apps: [
    // Main Next.js Application (Production)
    {
      name: 'gelani-main',
      script: 'bun',
      args: 'run start',
      cwd: './',
      
      // NO Hot Reload in Production
      watch: false,
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 30000,
      
      // Production Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      
      // Logging
      error_file: './logs/gelani-main-error.log',
      out_file: './logs/gelani-main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Instance Management (can increase for clustering)
      instances: 1,
      exec_mode: 'fork',
    },
    
    // Medical RAG Service (Port 3031) - Production
    {
      name: 'gelani-medical-rag',
      script: 'bun',
      args: 'run mini-services/medical-rag-service.ts',
      cwd: './',
      
      // NO Hot Reload in Production
      watch: false,
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      
      // Production Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: '3031'
      },
      
      // Logging
      error_file: './logs/medical-rag-error.log',
      out_file: './logs/medical-rag-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    
    // LangChain RAG Service (Port 3032) - Production
    {
      name: 'gelani-langchain-rag',
      script: 'bun',
      args: 'run mini-services/langchain-rag-service.ts',
      cwd: './',
      
      // NO Hot Reload in Production
      watch: false,
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      
      // Production Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: '3032'
      },
      
      // Logging
      error_file: './logs/langchain-rag-error.log',
      out_file: './logs/langchain-rag-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    
    // MedASR Voice Service (Port 3033) - Production
    {
      name: 'gelani-medasr',
      script: 'bun',
      args: 'run mini-services/medasr-service.ts',
      cwd: './',
      
      // NO Hot Reload in Production
      watch: false,
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      
      // Production Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: '3033'
      },
      
      // Logging
      error_file: './logs/medasr-error.log',
      out_file: './logs/medasr-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }
  ]
};
