import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — the whole app is client-side, no server features needed.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
