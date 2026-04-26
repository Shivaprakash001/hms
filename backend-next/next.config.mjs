import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"]
    },
    webpack: (config) => {
        config.externals.push("@sparticuz/chromium");
        config.externals.push("puppeteer-core");
        return config;
    }
};

export default nextConfig;
