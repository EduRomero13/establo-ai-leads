import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mssql"],
  reactStrictMode: true,
};

export default nextConfig;

