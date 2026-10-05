// Screenshots of the Kwerft console with demo data, for the homepage.
//
//   npm run shots -- --werft ../../../werft            all shots, light and dark
//   npm run shots -- --werft ../../../werft --only apps,jobs
//   npm run shots -- --skip-build                       reuse .cache/console
//
// Builds the console from the werft checkout into .cache/console (nothing in
// the werft tree changes), serves it with the mock API (mock/server.mjs),
// drives Google Chrome with Playwright and writes PNGs to
// ../../src/assets/screenshots. Everything stops when it is done.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "./mock/server.mjs";
import { shellHost, transcript } from "./mock/terminal.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (k) => args.includes(k);

const werft = path.resolve(arg("--werft", path.join(here, "../../../werft")));
const out = path.resolve(arg("--out", path.join(here, "../../src/assets/screenshots")));
const dist = path.join(here, ".cache/console");
const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const port = Number(arg("--port", 8099));
const base = `http://127.0.0.1:${port}`;

// ---- the shots -------------------------------------------------------------------

/** Waits until the page shows data: no loading placeholders, fonts in, charts drawn. */
async function settle(page, extra = 400) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => {
    const busy = [...document.querySelectorAll(".loading")].some((e) => e.offsetParent !== null);
    const text = document.body.innerText;
    return !busy && !/Loading |Checking…|Updating…/.test(text);
  }, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(extra);
}

const tab = (name) => async (page) => {
  await page.getByRole("tab", { name, exact: false }).first().click();
  await settle(page);
};

const shots = [
  { name: "overview", path: "/" },
  { name: "apps", path: "/apps" },
  { name: "app-detail", path: "/apps/shop/storefront" },
  {
    name: "deploy", path: "/apps/new?project=shop",
    act: async (page) => {
      await page.getByRole("button", { name: /Git repository/ }).click();
      await page.locator("#d-name").fill("invoices");
      await page.locator("#d-repo").fill("github.com/example-shop/invoices");
      await page.locator("#d-branch").fill("main");
      await page.locator("#d-repo").blur();
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.locator(".check-line").waitFor();
      await page.locator("#d-name").focus();
      await page.locator("#d-name").evaluate((e) => e.blur());
      await settle(page);
    },
  },
  { name: "jobs", path: "/jobs" },
  {
    name: "monitoring-metrics", path: "/monitoring/metrics",
    act: async (page) => {
      await page.getByRole("button", { name: "24h", exact: true }).click();
      await settle(page, 800);
    },
  },
  { name: "monitoring-logs", path: "/monitoring/logs?project=shop" },
  { name: "monitoring-alerts", path: "/monitoring" },
  { name: "network-traffic", path: "/network", act: tab("Traffic rules") },
  { name: "network-firewall", path: "/network", act: tab("Server firewall") },
  { name: "clusters", path: "/clusters/hel1-staging" },
  { name: "cluster-nodes", path: "/clusters/local/nodes" },
  { name: "updates", path: "/settings/updates" },
  { name: "backups", path: "/backups" },
  { name: "secrets", path: "/secrets?project=shop" },
  {
    name: "templates", path: "/apps/new?project=internal",
    act: async (page) => {
      await page.getByRole("button", { name: /^Template/ }).click();
      await page.locator(".tpl-grid .tpl").first().waitFor();
      await settle(page);
    },
  },
  {
    name: "compose", path: "/apps/new?project=shop",
    act: async (page) => {
      await page.getByRole("button", { name: /^Docker Compose/ }).click();
      await page.locator("#c-file").fill(fs.readFileSync(path.join(here, "mock/data/compose-returns.yaml"), "utf8"));
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.getByText("Kwerft will create").first().waitFor();
      await settle(page);
      await page.evaluate(() => document.querySelectorAll("*").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  { name: "access-members", path: "/access" },
  { name: "access-audit", path: "/access/audit" },
  { name: "settings", path: "/settings" },
  {
    name: "terminal", path: "/apps/shop/storefront",
    act: async (page) => {
      await page.getByRole("button", { name: "Shell", exact: true }).first().click();
      await page.locator(".shell-dlg .xterm-rows").waitFor();
      await page.getByText("Recorded", { exact: true }).waitFor();
      await page.waitForTimeout(800);
    },
  },
  {
    name: "setup", path: "/setup", setup: true,
    act: async (page) => {
      await page.locator("#setup-token").fill("kwft_setup_7Qm2vX9pLk4RtB8n");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.locator("#owner-name").fill("Mara Lindqvist");
      await page.locator("#owner-email").fill("mara@example.com");
      await page.locator("#owner-password").fill("correct horse battery staple");
      await page.locator("#owner-confirm").fill("correct horse battery staple");
      await page.locator("#owner-confirm").blur();
      await settle(page);
    },
  },
  { name: "overview-mobile", path: "/", themes: ["light"], viewport: { width: 390, height: 844 }, scale: 3, mobile: true },
];

// ---- run -------------------------------------------------------------------------

function build() {
  const web = path.join(werft, "web");
  if (!fs.existsSync(path.join(web, "package.json"))) throw new Error(`No console at ${web}. Pass --werft <path to the werft checkout>.`);
  if (!fs.existsSync(path.join(web, "node_modules/.bin/vite"))) throw new Error(`Run npm ci in ${web} first (its node_modules are missing).`);
  console.log(`Building the console from ${web} …`);
  const r = spawnSync(path.join(web, "node_modules/.bin/vite"), ["build", "--outDir", dist, "--emptyOutDir", "--logLevel", "warn"], { cwd: web, stdio: "inherit" });
  if (r.status !== 0) throw new Error("vite build failed");
}

async function main() {
  if (!flag("--skip-build") || !fs.existsSync(path.join(dist, "index.html"))) build();
  fs.mkdirSync(out, { recursive: true });

  const { server, misses } = createServer({ dist });
  await new Promise((ok, fail) => server.once("error", fail).listen(port, "127.0.0.1", ok));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const problems = [];
  const written = [];
  try {
    for (const shot of shots) {
      if (only && !only.includes(shot.name)) continue;
      for (const theme of shot.themes ?? ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: shot.viewport ?? { width: 1440, height: 900 },
          deviceScaleFactor: shot.scale ?? 2,
          colorScheme: theme,
          isMobile: !!shot.mobile,
          hasTouch: !!shot.mobile,
          locale: "en-GB",
          timezoneId: "Europe/Berlin",
        });
        if (shot.setup) await context.addCookies([{ name: "kwerft-mock", value: "setup", url: base }]);
        const page = await context.newPage();
        // Shells are WebSockets: answer like the console does, with a session already under way.
        await page.routeWebSocket(/\/shell\?/, (ws) => {
          ws.onMessage(() => {});
          ws.send(JSON.stringify({ type: "started", pod: shellHost, container: "storefront", shell: "auto", recording: "rec-7f3a91", idleSeconds: 900, maxSeconds: 3600 }));
          ws.send(Buffer.from(transcript()));
        });
        const failed = [];
        page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 400 && !(shot.setup && r.url().endsWith("/session"))) failed.push(`${r.status()} ${r.url()}`); });
        page.on("pageerror", (e) => failed.push(`page error: ${e.message}`));
        await page.goto(base + shot.path);
        await settle(page);
        if (shot.act) await shot.act(page);
        await page.mouse.move(0, 0);
        const file = path.join(out, `${shot.name}-${theme}.png`);
        await page.screenshot({ path: file });
        written.push(file);
        console.log(`  ${path.relative(process.cwd(), file)}${failed.length ? `  (${failed.length} failed requests)` : ""}`);
        if (failed.length) problems.push(`${shot.name}-${theme}: ${[...new Set(failed)].join(", ")}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
    server.closeAllConnections?.();
  }
  if (misses.length) console.warn(`\nThe mock had no fixture for:\n  ${[...new Set(misses)].join("\n  ")}`);
  if (problems.length) {
    console.warn(`\nRequests that failed:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  }
  console.log(`\n${written.length} screenshots in ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
