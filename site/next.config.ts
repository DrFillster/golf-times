import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Mirror LMDW: this side-effect import wires up OpenNext for `next dev`.
  // Harmless in production builds.
  ...(process.env.NODE_ENV !== "production" && {
    webpack: (config: unknown) => config,
  }),
};

// This runs once at module load; it's a no-op in production.
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});

export default nextConfig;