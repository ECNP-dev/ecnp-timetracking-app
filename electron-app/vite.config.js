
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  root: ".",          // Vite uses index.html here
  base: "./",         // Required for Electron file://
  
  server: {
    port: 3000,
    strictPort: true
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html"   // forces Vite to use correct entry
    }
  }
});
