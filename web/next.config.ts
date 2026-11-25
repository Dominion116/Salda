import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      // Only Base Account's unused server-side payment code imports this. See the stub for why.
      "@coinbase/cdp-sdk": "./src/lib/stubs/cdp-sdk.ts",
    },
  },
};

export default nextConfig;
