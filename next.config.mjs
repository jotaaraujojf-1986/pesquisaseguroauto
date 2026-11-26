/** @type {import('next').NextConfig} */
const SUPABASE = "https://aseiiogpqmnfewlbbmun.supabase.co";
const CLOUDFLARE = "https://challenges.cloudflare.com";

// Regras do navegador: de onde a página pode carregar coisas e para onde pode mandar dados.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CLOUDFLARE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://aseiiogpqmnfewlbbmun.supabase.co ${CLOUDFLARE} https://viacep.com.br`,
  `frame-src ${CLOUDFLARE}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cabecalhos = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: cabecalhos },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};
export default nextConfig;
