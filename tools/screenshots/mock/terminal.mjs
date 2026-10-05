// What the demo shell shows: a short session in a storefront replica. Used by
// the live shell (a mocked WebSocket in shoot.mjs) and by the recordings'
// .cast files (server.mjs).
import { sha } from "./fixtures.mjs";

const commit = sha("shop/storefront/48").slice(0, 7);
const clock = (secondsAgo) => new Date(Date.now() - secondsAgo * 1000).toLocaleTimeString("en-GB", { timeZone: "Europe/Berlin" });

const host = "storefront-6c8d9f7b5-x2kqp";
const prompt = `\u001b[1;32mnode@${host}\u001b[0m:\u001b[1;34m/app\u001b[0m$ `;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

/** [seconds, text] pairs; commands are typed out character by character in the cast. */
export const session = () => [
  { cmd: "node --version", out: "v22.20.0" },
  { cmd: "curl -s localhost:3000/healthz", out: `{"status":"ok","commit":"${commit}","uptime_s":8041,"cache":"warm"}` },
  { cmd: "env | grep -E '^(NODE_ENV|API_URL)='", out: "NODE_ENV=production\r\nAPI_URL=http://api.shop.svc:8080" },
  { cmd: "curl -s -o /dev/null -w '%{http_code} in %{time_total}s\\n' $API_URL/v2/products/SKU-10482", out: "200 in 0.014s" },
  { cmd: "du -sh .next/cache", out: "212M\t.next/cache" },
  {
    cmd: "ps -o pid,rss,etime,args",
    out: [
      "  PID   RSS     ELAPSED COMMAND",
      "    1  1956    02:14:01 /usr/bin/tini -- node server.js",
      "    7 312440   02:14:01 node server.js",
      "   58  4120       00:41 bash",
      "   71  2380       00:00 ps -o pid,rss,etime,args",
    ].join("\r\n"),
  },
  { cmd: "tail -n 4 /tmp/next-cache.log", out: [
    `${dim(clock(41))} revalidated /products/linen-shirt in 38ms`,
    `${dim(clock(38))} revalidated /category/summer in 52ms`,
    `${dim(clock(34))} hit /checkout (edge cache)`,
    `${dim(clock(29))} revalidated /products/rain-jacket in 41ms`,
  ].join("\r\n") },
];

/** The whole session as terminal output, ending at a fresh prompt. */
export function transcript() {
  let s = "";
  for (const step of session()) s += `${prompt}${step.cmd}\r\n${step.out}\r\n`;
  return s + prompt;
}

/** An asciicast v2 file of the session. */
export function cast(width = 120, height = 30) {
  const lines = [JSON.stringify({ version: 2, width, height, timestamp: 1759650000, env: { SHELL: "/bin/bash", TERM: "xterm-256color" } })];
  let t = 0.3;
  const out = (text) => lines.push(JSON.stringify([Number(t.toFixed(3)), "o", text]));
  out(prompt);
  for (const step of session()) {
    t += 0.6;
    for (const ch of step.cmd) {
      t += 0.045;
      out(ch);
    }
    t += 0.25;
    out(`\r\n${step.out}\r\n`);
    t += 0.05;
    out(prompt);
  }
  return lines.join("\n") + "\n";
}

export const shellHost = host;
