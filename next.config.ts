import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactStrictMode: false,
  
  // PROMPT 13: Enable OpenTelemetry instrumentation hook
  // This allows src/instrumentation.ts to be loaded on server startup
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
