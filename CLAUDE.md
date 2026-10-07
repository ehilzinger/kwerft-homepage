# kwerft.dev — notes for Claude

Marketing site and docs for Kwerft. The product lives in the sibling repo
`../werft` (public since 2026-10-05, AGPL-3.0-only); it is the source of truth for every claim here — check
`install/install.sh --help`, `docs/plan.md` and `web/src/pages` before writing
about a feature, and mark anything not in the latest stable release.

- Branding mirrors the console: tokens in `src/styles/tokens.css` (keep in sync
  with werft), fonts self-hosted via @fontsource.
- CSP is `'self'` only (`netlify.toml`): no inline `<script>` or `style=""`
  attributes; Astro bundles component scripts into files.
- Screenshots: `tools/screenshots` builds the real console against a mock API
  (`mock/fixtures.mjs`); demo data must stay fictional (example.com,
  documentation IP ranges, made-up people).
- Release facts (`LATEST`, install URL) live in `src/site.ts`.
- Search engines: `@astrojs/sitemap` writes `sitemap-index.xml` (filter in
  `astro.config.mjs`), `public/robots.txt` points at it. A page that should
  stay out of Google gets `noindex` on `<Base>` and goes into that filter;
  pages with a translation pass `alternates` (hreflang). JSON-LD goes through
  `<Base jsonld>` (a data block, allowed under the CSP).
