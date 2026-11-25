import type { NextConfig } from "next";

// Security headers (pentest 2026-11-25). No script-src yet: Next's own inline scripts would need nonces.
// frame-ancestors stops other sites framing the login (clickjacking); form-action lets the Google sign-in form redirect.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://*.supabase.co https://accounts.google.com" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() { return [{ source: "/:path*", headers: SECURITY_HEADERS }]; },
  cacheComponents: true,
  // Sign-up sends a photo (≤2 MB) through a server action; the default cap is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
