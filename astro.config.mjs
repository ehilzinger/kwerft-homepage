import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://kwerft.dev",
  devToolbar: { enabled: false },
  // sitemap-index.xml for search engines; pages that are noindex stay out.
  integrations: [sitemap({ filter: (page) => !/\/(thanks|404)(\.html)?$/.test(page) })],
  trailingSlash: "never",
  build: { format: "file", inlineStylesheets: "never" },
  // CSP is 'self' only (netlify.toml): keep scripts and fonts in files, never inline.
  vite: { build: { assetsInlineLimit: 0 } },
  // Prism marks tokens with classes; Shiki would write inline styles, which the CSP blocks.
  markdown: { syntaxHighlight: "prism" },
});
