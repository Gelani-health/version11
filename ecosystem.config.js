/**
 * PM2 Ecosystem Configuration for Gelani Healthcare
 * ==================================================
 * 
 * Starts all services with HOT RELOAD enabled:
 * - Main Next.js Application (3000)
 * - Medical RAG Service (3031)
 * - LangChain RAG Service (3032)
 * - MedASR Voice Service (3033)
 * 
 * Usage:
 *   npx pm2 start ecosystem.config.js     - Start with hot reload
 *   npx pm2 list                          - Check status
 *   npx pm2 logs                          - View logs
 *   npx pm2 stop all                      - Stop all services
 *   npx pm2 restart all                   - Restart all services
 *   npx pm2 save                          - Save configuration
 * 
 * Hot Reload:
 *   - Watch mode enabled for development
 *   - Automatic restart on file changes
 *   - Ignored: node_modules, .next, logs, data
 */

const WATCH_IGNORE = [
  'node_modules',
  '.next',
  '.git',
  'logs',
  'data',
  '*.log',
  '*.db',
  '*.db-journal',
  '*.db-wal',
];

module.exports = {
  apps: [
    // Main Next.js Application (Development with Hot Reload)
    {
      name: 'gelani-main',
      script: 'bun',
      args: 'run dev -p 3000',
      cwd: './',
      
      // Hot Reload Configuration
      watch: true,
      watch_delay: 1000,
      ignore_watch: WATCH_IGNORE,
      watch_options: {
        followSymlinks: false,
        usePolling: false,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      },
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: '3000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      
      // Logging
      error_file: './logs/gelani-main-error.log',
      out_file: './logs/gelani-main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Instance Management
      instances: 1,
      exec_mode: 'fork',
    },
    
    // Medical RAG Service (Port 3031) - Hot Reload Enabled
    {
      name: 'gelani-medical-rag',
      script: 'bun',
      args: 'run mini-services/medical-rag-service.ts',
      cwd: './',
      
      // Hot Reload Configuration
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        ...WATCH_IGNORE,
        'mini-services/**/node_modules',
        'mini-services/**/*.pyc',
        'mini-services/**/__pycache__',
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
      kill_timeout: 3000,
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: '3031'
      },
      
      // Logging
      error_file: './logs/medical-rag-error.log',
      out_file: './logs/medical-rag-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    
    // LangChain RAG Service (Port 3032) - Hot Reload Enabled
    {
      name: 'gelani-langchain-rag',
      script: 'bun',
      args: 'run mini-services/langchain-rag-service.ts',
      cwd: './',
      
      // Hot Reload Configuration
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        ...WATCH_IGNORE,
        'mini-services/**/node_modules',
        'mini-services/**/*.pyc',
        'mini-services/**/__pycache__',
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
      kill_timeout: 3000,
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: '3032'
      },
      
      // Logging
      error_file: './logs/langchain-rag-error.log',
      out_file: './logs/langchain-rag-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    
    // MedASR Voice Service (Port 3033) - Hot Reload Enabled
    {
      name: 'gelani-medasr',
      script: 'bun',
      args: 'run mini-services/medasr-service.ts',
      cwd: './',
      
      // Hot Reload Configuration
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        ...WATCH_IGNORE,
        'mini-services/**/node_modules',
        'mini-services/**/*.pyc',
        'mini-services/**/__pycache__',
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },
      
      // Restart Configuration
      autorestart: true,
      max_restarts: 5,
      restart_delay: 2000,
      kill_timeout: 3000,
      
      // Environment
      env: {
        NODE_ENV: 'development',
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
