import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import istanbul from 'vite-plugin-istanbul'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Vite plugin that generates a version.json manifest in the build output.
// The client polls this file to detect new deployments and prompt users to reload.
// The buildId is a timestamp so it changes on every build, even if the version stays the same.
function versionManifestPlugin(version: string): Plugin {
  return {
    name: 'version-manifest',
    apply: 'build',
    closeBundle() {
      const manifest = {
        version,
        buildId: new Date().toISOString(),
      }
      writeFileSync(
        resolve(__dirname, 'dist', 'version.json'),
        JSON.stringify(manifest, null, 2)
      )
      console.log(`[version-manifest] Generated version.json: v${version}, build ${manifest.buildId}`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev-server proxy targets (Node inside the container/host). Prefer DEV_PROXY_* so
  // Docker Compose can use service DNS (chat-api, email-api) while VITE_* stays as
  // browser-facing localhost URLs. Read process.env first — loadEnv only merges
  // process.env over keys that also appear in .env files.
  const chatApiUrl =
    process.env.DEV_PROXY_API_URL ||
    env.DEV_PROXY_API_URL ||
    process.env.VITE_API_URL ||
    env.VITE_API_URL ||
    process.env.VITE_CHAT_API_URL ||
    env.VITE_CHAT_API_URL ||
    'http://localhost:8080'
  const emailApiUrl =
    process.env.DEV_PROXY_EMAIL_URL ||
    env.DEV_PROXY_EMAIL_URL ||
    process.env.VITE_EMAIL_API_URL ||
    env.VITE_EMAIL_API_URL ||
    'http://localhost:7073'
  const port = parseInt(process.env.VITE_PORT || env.VITE_PORT || '', 10) || 5173

  // Read version from monorepo root package.json, then client package.json (CE Docker).
  let appVersion = '0.0.0'
  for (const candidate of [
    resolve(__dirname, '../package.json'),
    resolve(__dirname, 'package.json'),
  ]) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8'))
      if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
        appVersion = pkg.version.trim()
        break
      }
    } catch {
      // try next
    }
  }

  const ceBuild = (env.VITE_CE_BUILD || '').trim().toLowerCase()
  const isCeBuild = ceBuild === 'true' || ceBuild === '1'

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: [
        // CE Phase 1b: paid UI barrel swaps to stubs when VITE_CE_BUILD is on
        {
          find: '@ce/paid-ui',
          replacement: isCeBuild
            ? resolve(__dirname, 'src/ce/paid-ui.ce.ts')
            : resolve(__dirname, 'src/ce/paid-ui.ts'),
        },
        // CE: omit real MSAL packages from the bundle (npm omit at export).
        // Plaid Link / bank-verification: stub files live at the real import paths
        // under src/components/ (regex aliases broke Vite id resolution and blanked the SPA).
        ...(isCeBuild
          ? [
              {
                find: '@azure/msal-browser',
                replacement: resolve(__dirname, 'src/ce/stubs/msal-browser.ts'),
              },
              {
                find: '@azure/msal-react',
                replacement: resolve(__dirname, 'src/ce/stubs/msal-react.tsx'),
              },
            ]
          : []),
      ],
    },
    plugins: [
      react(),
      // Generate version.json for cache-busting version detection
      versionManifestPlugin(appVersion),
      ...(process.env.VITE_COVERAGE === 'true'
        ? [istanbul({
            include: 'src/*',
            exclude: ['node_modules', 'tests/'],
            extension: ['.ts', '.tsx', '.js', '.jsx'],
            requireEnv: true,
            forceBuildInstrument: mode === 'production',
          })]
        : []),
    ],
    server: {
      port,
      strictPort: true,
      host: true,
      allowedHosts: ['host.docker.internal'],
      proxy: {
        // All /api and /graphql traffic goes through chat-api, which handles
        // mutations via axios (with audit logging) and proxies GETs to DAB.
        '/api': {
          target: chatApiUrl,
          changeOrigin: true,
        },
        '/graphql': {
          target: chatApiUrl,
          changeOrigin: true,
          ws: true
        },
        '/email-api': {
          target: emailApiUrl,
          changeOrigin: true,
        }
      }
    }
  }
})
