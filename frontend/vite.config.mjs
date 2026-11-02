import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [
    {
      // The original app uses JSX in .js files. Transform it before Rollup
      // parses modules, while retaining the existing source-file layout.
      name: "acolhe-jsx-in-js",
      enforce: "pre",
      transform(code, id) {
        if (id.includes("/src/") && id.endsWith(".js")) {
          return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
        }
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "build",
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "react";
          if (id.includes("node_modules/lucide-react")) return "icons";
          if (id.includes("node_modules/sonner")) return "feedback";
          if (id.includes("src/components/Institutional.jsx")) return "institutional";
          if (id.includes("src/mvp/")) return "mvp";
        },
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
});
