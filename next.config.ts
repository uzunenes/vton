import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Compiler for optimized rendering
  reactCompiler: true,

  // Image optimization configuration
  images: {
    // Allow images from fal.ai and Google Cloud Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.fal.ai",
      },
      {
        protocol: "https",
        hostname: "fal.media",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "v3.fal.media",
      },
    ],
    // Modern image formats for smaller file sizes
    formats: ["image/avif", "image/webp"],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },

  // Turbopack configuration for Next.js 16+
  turbopack: {},
};

export default nextConfig;
