import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// Le build atterrit dans webapp/static/app/ : c'est ce dossier que le serveur
// Python sert (cf. webapp/statiques.py). Il est commité pour que `python3 -m
// webapp` fonctionne sans Node.
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../webapp/static/app',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // En développement : `npm run dev` d'un côté, `python3 -m webapp --port
    // 8010` de l'autre. L'API et les exports sont relayés vers le Python.
    proxy: {
      '/api': 'http://127.0.0.1:8010',
      '/export.csv': 'http://127.0.0.1:8010',
      '/export.xlsx': 'http://127.0.0.1:8010',
    },
  },
})
