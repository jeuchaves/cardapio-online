import type { NextConfig } from "next";

// O navegador sempre chama /api/... na mesma origem do site. Em desenvolvimento,
// o Next.js encaminha essas chamadas à API; em produção, quem faz isso é o Nginx.
const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3333";

const nextConfig: NextConfig = {
  // O E2E (pnpm e2e) usa outro diretório de build para não colidir com o `next dev`
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  agentRules: false,
  // Sem X-Powered-By: a resposta não anuncia a tecnologia do servidor
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // O token de acompanhamento está na URL: nada de cache, Referer ou indexação
  async headers() {
    return [
      {
        source: "/r/:slug/pedido/:token",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
