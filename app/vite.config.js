import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// ID unik tiap build — ditanam ke kode (__BUILD_ID__) dan ditulis ke dist/version.json,
// supaya aplikasi yang sedang terbuka bisa tahu ada versi baru (lihat src/lib/versiBaru.js).
const BUILD_ID = Date.now().toString(36)

function tulisVersiBuild() {
  return {
    name: 'tulis-versi-build',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tulisVersiBuild()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
