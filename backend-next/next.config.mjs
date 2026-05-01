import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium"],
    // Include font files in the serverless output bundle
    outputFileTracingIncludes: {
      "/api/payments/[id]/receipt": ["./lib/pdf/fonts/**/*"],
    },
  },
};

export default nextConfig;
