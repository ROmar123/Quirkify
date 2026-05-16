import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'dev';
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Sentry plugin must run last so it sees the final bundle. Disabled
      // automatically when SENTRY_AUTH_TOKEN is not present — keeps local
      // dev and preview builds fast.
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        release: { name: gitSha },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        disable: !sentryAuthToken,
        silent: !sentryAuthToken,
      }),
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://quirkify-recover.vercel.app',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Only emit source maps when the Sentry plugin is enabled (and will
      // upload + delete them post-build). Without the auth token the plugin
      // skips deletion, so emitting maps would leak source onto prod.
      sourcemap: !!sentryAuthToken,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['motion', 'lucide-react'],
            'vendor-sentry': ['@sentry/react'],
          },
        },
      },
    },
  };
});
