/**
 * PM2 Ecosystem Configuration for Gelani Healthcare Assistant
 * ============================================================
 * 
 * World-Class Clinical Decision Support System
 * 
 * Usage:
 *   pm2 start ecosystem.config.js       # Start all services
 *   pm2 restart all                      # Restart all services
 *   pm2 stop all                         # Stop all services
 *   pm2 logs                             # View logs
 *   pm2 monit                            # Monitor resources
 *   pm2 save                             # Save process list
 *   pm2 startup                          # Generate startup script
 * 
 * Windows Usage:
 *   npm run pm2:start
 *   npm run pm2:stop
 *   npm run pm2:logs
 * 
 * Requirements:
 *   - Node.js 18+ or Bun
 *   - PM2: npm install -g pm2
 *   - Python 3.10+ (for RAG services)
 */

module.exports = {
  apps: [
    // Main Gelani Application
    {
      name: 'gelani-main',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'file:./data/healthcare.db',
        SESSION_SECRET: 'gelani-healthcare-session-secret-key-minimum-32-characters-secure-production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./data/healthcare.db',
        SESSION_SECRET: 'gelani-healthcare-session-secret-key-minimum-32-characters-secure-production',
        PORT: 3000,
      },
      watch: false,
      ignore_watch: ['node_modules', '.next', 'data', 'logs', '*.log'],
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // Medical RAG Service (Python FastAPI)
    {
      name: 'medical-rag',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/medical-rag-service',
      interpreter: 'python3',
      env: {
        PORT: '3031',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      env_production: {
        PORT: '3031',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      error_file: './logs/medical-rag-error.log',
      out_file: './logs/medical-rag-out.log',
      time: true,
    },

    // LangChain RAG Service (Python FastAPI)
    {
      name: 'langchain-rag',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/langchain-rag-service',
      interpreter: 'python3',
      env: {
        PORT: '3032',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      env_production: {
        PORT: '3032',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      error_file: './logs/langchain-rag-error.log',
      out_file: './logs/langchain-rag-out.log',
      time: true,
    },

    // Medical ASR Service (Python FastAPI)
    {
      name: 'medasr',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/medasr-service',
      interpreter: 'python3',
      env: {
        PORT: '3033',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      env_production: {
        PORT: '3033',
        PYTHONPATH: './',
        HOST: '0.0.0.0',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      error_file: './logs/medasr-error.log',
      out_file: './logs/medasr-out.log',
      time: true,
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'gelani',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:Gelani-health/version11.git',
      path: '/opt/gelani',
      'post-deploy': 'npm install && npm run build && npm run db:push && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get install git nodejs npm -y && npm install -g pm2',
    },
  },
};
