/**
 * PM2 Ecosystem Configuration for Gelani Healthcare Assistant
 * ============================================================
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart all
 *   pm2 stop all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'gelani-main',
      script: 'bun',
      args: 'run dev',
      cwd: './',
      env: {
        DATABASE_URL: 'file:./db/custom.db',
        NODE_ENV: 'development',
        SESSION_SECRET: 'gelani-healthcare-session-secret-key-minimum-32-characters-secure'
      },
      env_production: {
        DATABASE_URL: 'file:./db/custom.db',
        NODE_ENV: 'production',
        SESSION_SECRET: 'gelani-healthcare-session-secret-key-minimum-32-characters-secure'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
    },
    {
      name: 'medical-rag',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/medical-rag-service',
      env: {
        PORT: '3031',
        PYTHONPATH: './',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
    {
      name: 'langchain-rag',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/langchain-rag-service',
      env: {
        PORT: '3032',
        PYTHONPATH: './',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
    {
      name: 'medasr',
      script: 'python3',
      args: 'index.py',
      cwd: './mini-services/medasr-service',
      env: {
        PORT: '3033',
        PYTHONPATH: './',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
};
