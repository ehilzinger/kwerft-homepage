import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kwerft.dev",
  devToolbar: { enabled: false },
  trailingSlash: "never",
  build: { format: "file", inlineStylesheets: "never" },
  // CSP is 'self' only (netlify.toml): keep scripts and fonts in files, never inline.
  vite: { build: { assetsInlineLimit: 0 } },
  // Prism marks tokens with classes; Shiki would write inline styles, which the CSP blocks.
  markdown: { syntaxHighlight: "prism" },
});
