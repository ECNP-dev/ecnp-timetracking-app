
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: ".",                      // Project root
  publicDir: "public",            // Location of index.html
  build: {
    outDir: "dist",               // Where Vite will output the frontend build
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    strictPort: true
  }
});
