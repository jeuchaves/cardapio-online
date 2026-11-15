import type { NextConfig } from "next";

// O navegador sempre chama /api/... na mesma origem do site. Em desenvolvimento,
// o Next.js encaminha essas chamadas à API; em produção, quem faz isso é o Nginx.
const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3333";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
