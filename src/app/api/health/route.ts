/**
 * Health Check API - Public Endpoint
 * No authentication required
 * 
 * Returns comprehensive health status including:
 * - Application status
 * - Database health (SQLite with WAL mode)
 * - Microservices status
 * - System metrics
 */

import { NextResponse } from 'next/server';
import { checkDatabaseHealth, type DatabaseHealth } from '@/lib/db';

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'unavailable';
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    main: ServiceStatus;
    database: ServiceStatus;
    medicalRag: ServiceStatus;
    langchainRag: ServiceStatus;
    medasr: ServiceStatus;
  };
  database: {
    journalMode: string;
    integrity: boolean;
    size: number;
    walSize?: number;
    backups: number;
    lastBackup?: string;
  } | null;
  system: {
    uptime: number;
    environment: string;
    nodeVersion: string;
    platform: string;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  
  const health: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      main: { status: 'operational' },
      database: { status: 'checking...' },
      medicalRag: { status: 'checking...' },
      langchainRag: { status: 'checking...' },
      medasr: { status: 'checking...' },
    },
    database: null,
    system: {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
      },
    },
  };
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  health.system.memoryUsage = {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rss: memUsage.rss,
  };
  
  // Check database health
  try {
    const dbHealth = await checkDatabaseHealth();
    
    health.services.database = {
      status: dbHealth.status === 'healthy' ? 'operational' : 
              dbHealth.status === 'degraded' ? 'degraded' : 'unavailable',
    };
    
    health.database = {
      journalMode: dbHealth.journalMode,
      integrity: dbHealth.integrity,
      size: dbHealth.size,
      walSize: dbHealth.walSize,
      backups: dbHealth.backups,
      lastBackup: dbHealth.lastBackup || undefined,
    };
    
    if (dbHealth.journalMode !== 'wal') {
      health.services.database.status = 'degraded';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.database = {
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }
  
  // Check microservices in parallel
  const serviceUrls = [
    { name: 'medicalRag' as const, url: 'http://localhost:3031/health' },
    { name: 'langchainRag' as const, url: 'http://localhost:3032/health' },
    { name: 'medasr' as const, url: 'http://localhost:3033/health' },
  ];
  
  await Promise.all(
    serviceUrls.map(async (service) => {
      const serviceStart = Date.now();
      try {
        const response = await fetch(service.url, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        
        const latency = Date.now() - serviceStart;
        
        health.services[service.name] = {
          status: response.ok ? 'operational' : 'degraded',
          latency,
        };
        
        if (!response.ok) {
          health.status = 'degraded';
        }
      } catch (error) {
        health.services[service.name] = {
          status: 'unavailable',
          latency: Date.now() - serviceStart,
          error: error instanceof Error ? error.message : 'Connection failed',
        };
        health.status = 'degraded';
      }
    })
  );
  
  // Determine overall status
  const allServices = Object.values(health.services);
  const hasUnavailable = allServices.some(s => s.status === 'unavailable');
  const hasDegraded = allServices.some(s => s.status === 'degraded');
  
  if (hasUnavailable && health.services.database.status === 'unavailable') {
    health.status = 'unhealthy';
  } else if (hasDegraded || hasUnavailable) {
    health.status = 'degraded';
  }
  
  const totalLatency = Date.now() - startTime;
  
  return NextResponse.json({
    ...health,
    latency: totalLatency,
  }, {
    status: health.status === 'unhealthy' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': health.status,
      'X-Response-Time': `${totalLatency}ms`,
    },
  });
}
