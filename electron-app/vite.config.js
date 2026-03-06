
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use relative base so file:// loads assets correctly in packaged Electron
  base: "./",                           // Vite allows './' for embedded/file-based deployment
  server: { port: 3000, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true }
});
