# Console screenshots

Real screenshots of the Kwerft console, filled with demo data, for the
homepage. They land in `src/assets/screenshots/` as `<name>-light.png` and
`<name>-dark.png` (1440×900 at 2×), plus `overview-mobile-light.png` (390×844
at 3×).

```sh
cd tools/screenshots
npm install                                # playwright only; downloads no browser
npm run shots -- --werft ../../../werft    # all shots
npm run shots -- --werft ../../../werft --only apps,jobs
npm run shots -- --skip-build              # reuse the last console build
```

The werft checkout needs its web dependencies once (`npm ci` in `werft/web`).

## What it does

1. Builds the console from `<werft>/web` with Vite into `.cache/console`.
   Nothing in the werft tree changes.
2. Starts `mock/server.mjs` on 127.0.0.1:8099: the built console plus a mock of
   `/api/v1` with the demo data in `mock/fixtures.mjs`.
3. Drives Google Chrome (Playwright, `channel: "chrome"`) through the pages in
   `shoot.mjs`, light and dark, and writes the PNGs.
4. Stops the browser and the server. It lists any API request the mock had no
   fixture for, and any request that failed, and exits non-zero if there were
   any.

`npm run mock -- --dist .cache/console` starts only the mock, to look around
in a browser at http://127.0.0.1:8099. A cookie `kwerft-mock=setup` makes the
console look freshly installed (the setup wizard).

## Demo data

A small company running a web shop: projects `shop`, `internal` (members only)
and `shop-staging`; the console's own cluster (`local`, Falkenstein: a
control-plane server, two cx33 workers and a dedicated AX42 for the database)
and a remote cluster `hel1-staging` connected through its agent. People, domains
(`example.com`) and addresses (203.0.113.0/24, 198.51.100.0/24, 192.0.2.0/24,
2001:db8::/32) are made up or reserved for documentation. Times are relative to
when the shots run; charts and logs come from a seeded generator, so runs look
the same.

Attention items on purpose: two firing alerts (`shop/worker` memory high, the
`backups` volume filling up), a `nightly-report` run killed for running out of
memory (limit 256Mi), and dropped connections from `shop/worker` to
`shop/payments` on Network › Traffic rules. The AX42's disks are healthy: a
RAID1 (md0–md2) over two NVMe drives, SMART passed, 34 % and 31 % worn
(`disk-health` shows the Nodes page scrolled to them). The Overview's
infrastructure map (`/topology`) is assembled from the same fixtures.

The shell (terminal shot) is a mocked WebSocket in `shoot.mjs`; its content is
in `mock/terminal.mjs`, which also serves the recordings' `.cast` files.

`SHOW_CLUSTER_CLOUD` in `mock/fixtures.mjs` is off: the Hetzner Cloud card on a
cluster page renders its checkbox labels unstyled (`.check` in `settings.css`
is scoped to `.settings`). Turn it on once that is fixed.
