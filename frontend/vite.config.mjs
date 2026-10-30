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
  },
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
});
