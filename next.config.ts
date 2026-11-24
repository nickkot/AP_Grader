import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is almost entirely per-teacher, request-time data, so Cache
  // Components and partial prefetching add complexity without benefit here.
  // See docs/DECISIONS.md.
  cacheComponents: false,
  // Native modules and packages that load .wasm or bundled workers at runtime stay out of the bundle.
  serverExternalPackages: ["sharp", "zxing-wasm", "unpdf", "@napi-rs/canvas", "@react-pdf/renderer", "postgres"],
  // The QR reader loads its .wasm from a path resolved at runtime, which file tracing cannot see.
  // The canvas native binary is loaded through an optional platform package. Ship both with every server function.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
