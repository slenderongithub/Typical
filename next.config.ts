import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // parent directory holds unrelated lockfiles — this repo is the root
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // browsers ignore HSTS over plain http, so localhost is unaffected
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // no framing: a camera-permission page must not be clickjackable
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // MediaPipe WASM + model assets: long-lived immutable cache,
        // correct content types are inferred; keep them same-origin so
        // no CORS round-trips are needed.
        source: "/:prefix(mediapipe|models)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
