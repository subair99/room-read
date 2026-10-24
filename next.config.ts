import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the MCP SDK (spawns `qloo mcp`) out of the server bundle.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  webpack: (config) => {
    // Cache and output files change constantly; don't reload the page for them.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/data/**", "**/spike/out/**", "**/eval/out/**"],
    };
    return config;
  },
};

export default nextConfig;
