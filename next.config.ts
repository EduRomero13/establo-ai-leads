import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mssql"],
  reactStrictMode: true,
};

export default nextConfig;

