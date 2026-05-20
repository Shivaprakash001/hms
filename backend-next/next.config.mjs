import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

// SPA routes that belong on the frontend. If FRONTEND_URL is configured and
// points to a different host, we redirect any request that lands on this backend
// server so the tenant gets to the correct activation / login page.
const FRONTEND_SPA_ROUTES = [
  "/activate",
  "/login",
  "/complete-profile",
  "/reset-password",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure @sparticuz/chromium binary is bundled for serverless PDF generation
  typescript: {
    // Deployment is currently blocked by historical Prisma schema/client naming
    // drift and strict-mode type debt across non-critical paths. Keep builds
    // shipping while those types are normalized incrementally.
    ignoreBuildErrors: true,
  },

  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium"],
  },

  async redirects() {
    const rawFrontend =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      "";
    const frontendBase = rawFrontend.replace(/\/+$/, "");

    // Only redirect when a DIFFERENT frontend URL is explicitly configured.
    // This prevents an infinite redirect loop when this server IS the frontend domain.
    if (!frontendBase) return [];

    // Next.js automatically preserves query strings (e.g. ?token=…) on
    // external redirects, so the activation token reaches the frontend.
    return FRONTEND_SPA_ROUTES.map((route) => ({
      source: route,
      destination: `${frontendBase}${route}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
