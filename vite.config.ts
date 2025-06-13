import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // 4. Configure build options to handle chunk size warnings
  build: {
    // Increase the warning limit for chunk size to 1000kb
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Configure manual chunks to better split the code
        manualChunks: {
          'element-plus': ['element-plus'],
          'codemirror': ['@codemirror/lang-sql', '@codemirror/theme-one-dark', 'vue-codemirror'],
          'vue-vendor': ['vue', 'pinia'],
        }
      }
    }
  },
}));
