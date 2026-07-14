import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/widget-entry.tsx"),
      name: "PrevAiWidget",
      fileName: () => "prevai-widget.js",
      formats: ["iife"],
    },
  },
});
