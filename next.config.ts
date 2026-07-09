import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // parent directory holds unrelated lockfiles — this repo is the root
    root: __dirname,
  },
  async headers() {
    return [
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
