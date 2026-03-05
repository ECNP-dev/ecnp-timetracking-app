
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  root: ".",                    // project root = electron-app/
  publicDir: "public",          // where index.html lives
  base: "",                     // IMPORTANT for Electron paths

  server: {
    port: 3000,
    strictPort: true
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "public/index.html")  // <-- THIS IS THE FIX
    }
  }
});
