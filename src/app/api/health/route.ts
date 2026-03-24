/**
 * Health Check API - Public Endpoint
 * No authentication required
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      main: 'operational',
      medicalRag: 'checking...',
      langchainRag: 'checking...',
      medasr: 'checking...',
    },
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };

  // Check microservices
  const serviceUrls = [
    { name: 'medicalRag', url: 'http://localhost:3031/health' },
    { name: 'langchainRag', url: 'http://localhost:3032/health' },
    { name: 'medasr', url: 'http://localhost:3033/health' },
  ];

  await Promise.all(
    serviceUrls.map(async (service) => {
      try {
        const response = await fetch(service.url, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });
        health.services[service.name as keyof typeof health.services] = 
          response.ok ? 'operational' : 'degraded';
      } catch {
        health.services[service.name as keyof typeof health.services] = 'unavailable';
      }
    })
  );

  const allHealthy = Object.values(health.services).every(
    s => s === 'operational' || s === 'checking...'
  );

  return NextResponse.json(health, {
    status: allHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
