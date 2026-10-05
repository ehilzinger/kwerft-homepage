# kwerft-homepage

The website at [kwerft.dev](https://kwerft.dev): the homepage, the getting
started guide and the help pages for [Kwerft](https://github.com/ehilzinger/kwerft-install),
a self-hosted Kubernetes console for Hetzner. Static [Astro](https://astro.build),
deployed by Netlify from `main`.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
```

| Path | What |
|---|---|
| `src/pages/` | Homepage, `getting-started`, docs index and `docs/[id]` |
| `src/content/docs/` | Help pages (Markdown; frontmatter schema in `src/content.config.ts`) |
| `src/site.ts` | Install command and latest release — update when a release ships |
| `src/styles/tokens.css` | Design tokens, copied from `werft/web/src/styles/tokens.css` |
| `src/assets/screenshots/` | Console screenshots, made by `tools/screenshots` |
| `netlify.toml` | Build, security headers (CSP `'self'`, nothing inline), redirects |

Screenshots are the real console with demo data from a mock API; regenerate
them after UI changes with `tools/screenshots` (see its README).
