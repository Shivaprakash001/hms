import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure @sparticuz/chromium binary is bundled for serverless PDF generation

  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium"],
  },
};

export default nextConfig;
