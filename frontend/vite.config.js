import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, rootEnvDir, '');
  return {
    envDir: rootEnvDir,
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@services": path.resolve(__dirname, "./src/services"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
        "@features": path.resolve(__dirname, "./src/features"),
        "@lib": path.resolve(__dirname, "./src/lib"),
        "@config": path.resolve(__dirname, "./src/config"),
        "@types": path.resolve(__dirname, "./src/types")
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
})
