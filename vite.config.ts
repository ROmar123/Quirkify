import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        manifest: false, // keep public/manifest.json as-is
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}', 'icons/*.png'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
        },
        devOptions: {
          enabled: false, // don't run SW in dev
        },
      }),
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['motion', 'lucide-react'],
          },
        },
      },
    },
  };
});
