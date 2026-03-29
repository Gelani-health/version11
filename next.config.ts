import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactStrictMode: false,
  
  // PROMPT 13: OpenTelemetry instrumentation is enabled by default in Next.js 16
  // src/instrumentation.ts is auto-loaded without experimental flag
};

export default nextConfig;
