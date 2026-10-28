import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  webpack: (config, { isServer }) => {
    config.cache = config.cache ?? {
      type: "filesystem",
      buildDependencies: {
        config: [__filename],
      },
    };

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          minSize: 20000,
          maxAsyncRequests: 30,
          maxInitialRequests: 25,
        },
      };
    }

    return config;
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;