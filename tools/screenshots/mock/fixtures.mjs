// Demo data for the Kwerft console: a small company running a web shop on
// Hetzner. Everything is fictional — example.com domains, documentation IP
// ranges (203.0.113.0/24, 198.51.100.0/24, 2001:db8::/32), made-up people.
//
// Times are relative to the moment of the request, so "12 min ago" stays
// "12 min ago" whenever the screenshots are taken. Random numbers come from a
// seeded generator, so every run produces the same charts.

// ---- helpers ------------------------------------------------------------------

export const MIN = 60;
export const HOUR = 3600;
export const DAY = 86400;

/** ISO time `s` seconds before now (negative: in the future). */
export const ago = (now, s) => new Date(now - s * 1000).toISOString();

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

export const sha = (seed) => {
  const r = rng(hash(seed));
  return Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
};
const podSuffix = (seed, n = 5) => {
  const r = rng(hash(seed));
  return Array.from({ length: n }, () => "bcdfghjklmnpqrstvwxz2456789"[Math.floor(r() * 27)]).join("");
};

/** See clusters(): the Hetzner Cloud card of a cluster page. */
export const SHOW_CLUSTER_CLOUD = true;

export const REGISTRY = "registry.kwerft.internal:5000";

// ---- people ----------------------------------------------------------------------

export const ME = { id: "u-mara", email: "mara@example.com", name: "Mara Lindqvist", role: "owner" };

export const people = [
  { id: "u-mara", name: "Mara Lindqvist", email: "mara@example.com", role: "owner", joined: 182 * DAY, active: 2 * MIN, f: ["passkey", "totp"] },
  { id: "u-jonas", name: "Jonas Becker", email: "jonas@example.com", role: "admin", joined: 176 * DAY, active: 47 * MIN, f: ["passkey"] },
  { id: "u-priya", name: "Priya Raman", email: "priya@example.com", role: "developer", joined: 150 * DAY, active: 3 * HOUR, f: ["totp"] },
  { id: "u-tomas", name: "Tomás Ortega", email: "tomas@example.com", role: "developer", joined: 121 * DAY, active: 26 * MIN, f: ["passkey"] },
  { id: "u-sam", name: "Sam Okafor", email: "sam@example.com", role: "developer", joined: 64 * DAY, active: 2 * DAY, f: ["passkey", "totp"] },
  { id: "u-lena", name: "Lena Hoffmann", email: "lena@example.com", role: "viewer", joined: 33 * DAY, active: 5 * DAY, f: ["totp"] },
];

// ---- projects and apps -------------------------------------------------------------

export function projects(now) {
  return [
    { name: "shop", displayName: "Web shop", phase: "ready", apps: 6, created: ago(now, 180 * DAY), access: "Team", role: "owner", members: [], cluster: "local" },
    {
      name: "internal", displayName: "Internal tools", phase: "ready", apps: 2, created: ago(now, 140 * DAY), access: "Members", role: "owner", cluster: "local",
      members: [
        { user: "priya@example.com", name: "Priya Raman", role: "developer" },
        { user: "sam@example.com", name: "Sam Okafor", role: "developer" },
        { user: "lena@example.com", name: "Lena Hoffmann", role: "viewer" },
      ],
    },
    { name: "shop-staging", displayName: "Shop staging", phase: "ready", apps: 3, created: ago(now, 60 * DAY), access: "Team", role: "owner", members: [], cluster: "hel1-staging" },
  ];
}

const gh = (repo) => `https://github.com/example-shop/${repo}`;

// The apps; `extra` holds what the detail page needs beyond the summary.
const appDefs = [
  {
    project: "shop", name: "storefront", cluster: "local", git: { repo: "storefront", branch: "main", builder: "dockerfile" },
    replicas: 3, ready: 3, revision: 48, updated: 2 * HOUR + 14 * MIN, size: "medium", port: 3000, public: "shop.example.com",
    health: { http: "/healthz", port: 3000 }, allowFrom: [], egress: "https", created: 178 * DAY,
    env: [
      { name: "NODE_ENV", value: "production" },
      { name: "API_URL", value: "http://api.shop.svc:8080" },
      { name: "PUBLIC_ASSET_HOST", value: "https://static.shop.example.com" },
      { name: "SESSION_SECRET", valueFrom: { secretKeyRef: { name: "storefront", key: "session-secret" } } },
    ],
  },
  {
    project: "shop", name: "api", cluster: "local", git: { repo: "api", branch: "main", builder: "dockerfile" },
    replicas: 3, ready: 3, revision: 112, updated: 38 * MIN, size: "medium", port: 8080, public: "api.shop.example.com",
    health: { http: "/readyz", port: 8080 }, allowFrom: ["storefront", "worker"], egress: "https", created: 178 * DAY,
    env: [{ name: "DATABASE_URL", valueFrom: { secretKeyRef: { name: "api-db", key: "url" } } }, { name: "REDIS_URL", value: "redis://redis.shop.svc:6379" }, { name: "LOG_FORMAT", value: "json" }],
  },
  {
    project: "shop", name: "payments", cluster: "local", image: "ghcr.io/example-shop/payments:2.8.1",
    replicas: 2, ready: 2, revision: 19, updated: 3 * DAY + 4 * HOUR, size: "small", port: 9000,
    health: { http: "/health", port: 9000 }, allowFrom: ["api", "worker"], egress: "https", created: 160 * DAY,
    env: [{ name: "PSP_API_KEY", valueFrom: { secretKeyRef: { name: "payments", key: "psp-key" } } }, { name: "CURRENCY", value: "EUR" }],
  },
  {
    project: "shop", name: "worker", cluster: "local", git: { repo: "api", branch: "main", builder: "dockerfile", path: "/", dockerfile: "Dockerfile.worker" },
    replicas: 2, ready: 2, revision: 64, updated: 38 * MIN, size: "small", egress: "https", created: 150 * DAY,
    env: [{ name: "QUEUES", value: "orders,emails,invoices" }, { name: "CONCURRENCY", value: "8" }],
  },
  {
    project: "shop", name: "postgres", cluster: "local", image: "postgres:17.6", stateful: true, volume: { path: "/var/lib/postgresql/data", size: "80Gi" },
    replicas: 1, ready: 1, revision: 7, updated: 21 * DAY, size: "large", port: 5432, health: { port: 5432 }, allowFrom: ["api", "worker", "internal/metabase"], egress: "none", created: 178 * DAY,
    env: [{ name: "POSTGRES_DB", value: "shop" }, { name: "POSTGRES_PASSWORD", valueFrom: { secretKeyRef: { name: "postgres", key: "password" } } }],
  },
  {
    project: "shop", name: "redis", cluster: "local", image: "redis:7.4-alpine", stateful: true, volume: { path: "/data", size: "5Gi" },
    replicas: 1, ready: 1, revision: 4, updated: 21 * DAY, size: "small", port: 6379, health: { port: 6379 }, allowFrom: ["api", "worker", "storefront"], egress: "none", created: 178 * DAY,
  },
  {
    project: "internal", name: "metabase", cluster: "local", image: "metabase/metabase:v0.56.4",
    replicas: 1, ready: 1, revision: 11, updated: 9 * DAY, size: "large", port: 3000, public: "bi.apps.example.com",
    health: { http: "/api/health", port: 3000 }, allowFrom: [], egress: "https", created: 130 * DAY,
  },
  {
    project: "internal", name: "handbook", cluster: "local", git: { repo: "handbook", branch: "main", builder: "railpack" },
    replicas: 2, ready: 2, revision: 87, updated: 5 * HOUR, size: "small", port: 8080, public: "handbook.apps.example.com",
    health: { http: "/", port: 8080 }, allowFrom: [], egress: "https", created: 120 * DAY,
  },
  {
    project: "shop-staging", name: "storefront", cluster: "hel1-staging", git: { repo: "storefront", branch: "staging", builder: "dockerfile" },
    replicas: 1, ready: 1, revision: 131, updated: 52 * MIN, size: "small", port: 3000, public: "storefront.staging.example.com",
    health: { http: "/healthz", port: 3000 }, allowFrom: [], egress: "https", created: 58 * DAY,
  },
  {
    project: "shop-staging", name: "api", cluster: "hel1-staging", git: { repo: "api", branch: "staging", builder: "dockerfile" },
    replicas: 1, ready: 1, revision: 204, updated: 2 * HOUR, size: "small", port: 8080, public: "api.staging.example.com",
    health: { http: "/readyz", port: 8080 }, allowFrom: ["storefront"], egress: "https", created: 58 * DAY,
  },
  {
    project: "shop-staging", name: "postgres", cluster: "hel1-staging", image: "postgres:17.6", stateful: true, volume: { path: "/var/lib/postgresql/data", size: "20Gi" },
    replicas: 1, ready: 1, revision: 3, updated: 40 * DAY, size: "small", port: 5432, health: { port: 5432 }, allowFrom: ["api"], egress: "none", created: 58 * DAY,
  },
];

const findDef = (project, name) => appDefs.find((a) => a.project === project && a.name === name);

const commitMessages = {
  storefront: [
    ["Show delivery estimate on product pages", "Tomás Ortega"],
    ["Lazy-load product images below the fold", "Priya Raman"],
    ["Fix basket total rounding for 19 % VAT", "Tomás Ortega"],
    ["Add Klarna to the checkout payment step", "Sam Okafor"],
    ["Cache category pages for 60 seconds", "Priya Raman"],
    ["Bump Next.js to 15.5", "Jonas Becker"],
    ["Translate size guide to French", "Sam Okafor"],
    ["Preload hero font", "Priya Raman"],
  ],
  api: [
    ["Index orders by customer and created_at", "Jonas Becker"],
    ["Retry PSP webhooks with backoff", "Sam Okafor"],
    ["Return 409 when a coupon is already used", "Tomás Ortega"],
    ["Add /v2/shipments endpoint", "Priya Raman"],
    ["Log request IDs in JSON format", "Jonas Becker"],
    ["Move invoice PDFs to object storage", "Sam Okafor"],
  ],
  handbook: [
    ["On-call: add payment incident checklist", "Mara Lindqvist"],
    ["Update returns policy page", "Lena Hoffmann"],
    ["Document the staging deploy flow", "Jonas Becker"],
  ],
};

function commitsOf(a) {
  const key = a.git?.repo === "api" ? "api" : a.git?.repo ?? a.name;
  return commitMessages[key] ?? commitMessages.storefront;
}

function imageOf(a, n = 0) {
  if (a.image) return a.image;
  return `${REGISTRY}/${a.project}/${a.name}:${sha(`${a.project}/${a.name}/${a.revision - n}`).slice(0, 7)}`;
}

function sourceOf(a) {
  if (a.image) return { type: "image", image: a.image };
  return {
    type: "git", repository: gh(a.git.repo), branch: a.git.branch, path: a.git.path ?? "/", builder: a.git.builder,
    ...(a.git.builder === "dockerfile" ? { dockerfile: a.git.dockerfile ?? "Dockerfile" } : {}),
    connection: "github-example-shop", autoDeploy: true,
  };
}

export function appSummaries(now) {
  return appDefs.map((a) => ({
    name: a.name, project: a.project, cluster: a.cluster, source: sourceOf(a), image: imageOf(a),
    readyReplicas: a.ready, replicas: a.replicas, stateful: !!a.stateful, phase: a.ready < a.replicas ? "deploying" : "running",
    reason: a.ready < a.replicas ? "Progressing" : "Available", message: `${a.ready} of ${a.replicas} replicas ready`,
    urls: a.public ? [`https://${a.public}`] : [], revision: a.revision, updated: ago(now, a.updated),
  }));
}

export function builds(now, project, name) {
  const a = findDef(project, name);
  if (!a?.git) return [];
  const msgs = commitsOf(a);
  const out = [];
  const base = a.name === "storefront" ? 142 : a.name === "api" ? 318 : a.name === "worker" ? 318 : 96;
  let t = a.updated + 3 * MIN;
  for (let i = 0; i < 8; i++) {
    const [message, author] = msgs[i % msgs.length];
    const number = base - i;
    const commit = sha(`${project}/${name}/${a.revision - i}`);
    const dur = 70 + Math.floor(rng(number)() * 120);
    const failed = a.name === "storefront" && i === 3;
    const pr = a.name === "storefront" && i === 1;
    out.push({
      name: `${name}-${number}`, project, number, app: name,
      source: { repository: gh(a.git.repo), path: a.git.path ?? "/", builder: a.git.builder, dockerfile: a.git.dockerfile ?? "Dockerfile", connection: "github-example-shop" },
      commit, branch: pr ? "feat/lazy-images" : a.git.branch, message, author,
      trigger: pr ? "pull-request" : "push", pullRequest: pr ? 271 : undefined, requestedBy: pr ? undefined : author,
      deploy: !pr, phase: failed ? "failed" : "succeeded", statusMessage: failed ? "npm ci: lockfile out of date" : undefined,
      image: failed ? undefined : `${REGISTRY}/${project}/${name}:${commit.slice(0, 7)}`,
      digest: failed ? undefined : `sha256:${sha(`d${number}`)}${sha(`e${number}`).slice(0, 24)}`,
      created: ago(now, t + dur + 20), started: ago(now, t + dur), finished: ago(now, t), durationSeconds: dur,
      deployedRevision: failed || pr ? undefined : a.revision - (i > 3 ? i - 2 : i > 1 ? i - 1 : i), current: i === 0,
    });
    t += (i % 2 ? 7 : 19) * HOUR + 13 * MIN;
  }
  return out;
}

export function appDetail(now, project, name) {
  const a = findDef(project, name);
  if (!a) return undefined;
  const history = Array.from({ length: Math.min(5, a.revision) }, (_, i) => {
    const commit = a.git ? sha(`${project}/${name}/${a.revision - i}`) : undefined;
    const b = a.git ? builds(now, project, name).find((x) => x.commit === commit) : undefined;
    return {
      number: a.revision - i, image: a.image ? (i === 0 ? a.image : a.image.replace(/:[^:]+$/, `:${["2.8.0", "2.7.3", "2.7.2", "2.7.1"][i - 1] ?? "2.7.0"}`)) : imageOf(a, i),
      generation: a.revision - i, build: b?.name, commit, time: ago(now, a.updated + i * (i === 1 ? 19 * HOUR : 2 * DAY + i * 5 * HOUR)),
    };
  });
  const latest = a.git ? builds(now, project, name)[0] : undefined;
  return {
    apiVersion: "kwerft.dev/v1alpha1", kind: "App",
    metadata: { name, namespace: project, resourceVersion: String(880000 + a.revision * 37), generation: a.revision, creationTimestamp: ago(now, a.created) },
    spec: {
      source: a.git
        ? { git: { repository: gh(a.git.repo), branch: a.git.branch, path: a.git.path ?? "/", builder: a.git.builder, ...(a.git.builder === "dockerfile" ? { dockerfile: a.git.dockerfile ?? "Dockerfile" } : {}), connection: "github-example-shop", autoDeploy: true } }
        : { image: { ref: a.image } },
      replicas: a.replicas, size: a.size, env: a.env ?? [],
      ports: a.port ? [{ container: a.port, ...(a.public ? { public: a.public } : {}) }] : [],
      allowFrom: a.allowFrom ?? [], egress: a.egress ?? "https",
      ...(a.volume ? { volumes: [a.volume] } : {}),
      ...(a.health ? { healthCheck: a.health } : {}),
    },
    status: {
      observedGeneration: a.revision, image: imageOf(a), revision: a.revision, history, readyReplicas: a.ready,
      urls: a.public ? [`https://${a.public}`] : [],
      conditions: [{ type: "Ready", status: "True", reason: "Available", message: `${a.ready} of ${a.replicas} replicas ready`, observedGeneration: a.revision, lastTransitionTime: ago(now, a.updated) }],
    },
    ...(latest ? { latestBuild: latest } : {}),
  };
}

const nodesLocal = ["fsn1-cp-1", "fsn1-workers-7k2mx", "fsn1-workers-q9xdt", "ax42-db-1"];

export function pods(now, project, name) {
  const a = findDef(project, name);
  if (!a) return { pods: [], metrics: true, access: { logs: true, exec: true } };
  const r = rng(hash(`${project}/${name}`));
  const rs = podSuffix(`${project}/${name}/rs`, 9).toLowerCase().replace(/[^a-z0-9]/g, "");
  const workers = a.cluster === "local" ? nodesLocal.slice(1, 3) : ["hel1-staging-workers-m4rt2", "hel1-staging-workers-x8kpz"];
  const mem = { small: 140, medium: 310, large: 900 }[a.size] ?? 200;
  const list = Array.from({ length: a.replicas }, (_, i) => {
    const pod = a.stateful ? `${name}-${i}` : (a.project === "shop" && podNames[name]?.[i]) || `${name}-${rs.slice(0, 9)}-${podSuffix(`${project}/${name}/${i}`)}`;
    return {
      name: pod, node: a.stateful && a.cluster === "local" && name === "postgres" ? "ax42-db-1" : workers[i % workers.length], phase: "Running", status: "Running", tone: "ok",
      ready: true, restarts: name === "worker" ? i + 1 : 0, created: ago(now, a.updated - 60 - i * 40),
      cpuMillis: Math.round((a.size === "large" ? 180 : a.size === "medium" ? 95 : 30) * (0.7 + r() * 0.6)),
      memoryBytes: Math.round(mem * (name === "worker" ? 1.6 : 0.85 + r() * 0.3) * 1024 * 1024),
      containers: [{ name, ready: true, state: "running", restarts: name === "worker" ? i + 1 : 0, ...(name === "worker" ? { lastTermination: { reason: "OOMKilled", exitCode: 137, finishedAt: ago(now, 3 * HOUR) } } : {}) }],
    };
  });
  return { pods: list, metrics: true, access: { logs: true, exec: true } };
}

// ---- metrics ---------------------------------------------------------------------

const STEPS = { "1h": 30, "6h": 120, "24h": 300, "7d": 3600 };
const SPANS = { "1h": HOUR, "6h": 6 * HOUR, "24h": DAY, "7d": 7 * DAY };

export function window_(range, nowMs) {
  const step = STEPS[range] ?? 30;
  const end = Math.floor(nowMs / 1000 / step) * step;
  const start = end - (SPANS[range] ?? HOUR);
  return { range, step, start, end };
}

/** Daily traffic shape for a shop in Europe: quiet at night, busy in the evening. */
function daily(t) {
  const h = ((t / 3600) % 24 + 24 + 2) % 24; // roughly Europe/Berlin
  const morning = Math.exp(-((h - 11) ** 2) / 10);
  const evening = Math.exp(-((h - 20.5) ** 2) / 6);
  return 0.25 + 0.55 * morning + 0.8 * evening;
}

/** A smooth noisy series: base × (shape + AR(1) noise). Values are aligned to absolute time, so ranges agree. */
export function series(win, seed, { base, daily: d = 0.6, noise = 0.08, min = 0, spikes = 0, round = false }) {
  const pts = [];
  const r = rng(hash(seed) ^ win.step);
  let n = 0;
  for (let t = win.start; t <= win.end; t += win.step) {
    // Same noise for the same absolute timestamp regardless of the window start.
    const local = rng(hash(seed) + Math.floor(t / win.step));
    n = 0.75 * n + (local() - 0.5) * noise * 2;
    let v = base * ((1 - d) + d * daily(t)) * (1 + n);
    if (spikes && local() < spikes) v *= 1.6 + r() * 0.8;
    v = Math.max(min, v);
    pts.push({ t, v: round ? Math.round(v) : v });
  }
  return pts;
}

export function appMetrics(nowMs, project, name, range) {
  const win = window_(range, nowMs);
  const a = findDef(project, name) ?? appDefs[0];
  const key = `${project}/${name}`;
  const limitPer = { small: 256, medium: 512, large: 2048 }[a.size] * 1024 * 1024;
  const busy = a.public || name === "payments" ? 1 : 0.3;
  const rpsBase = { storefront: 46, api: 120, payments: 6, metabase: 1.2, handbook: 0.8 }[name] ?? 0;
  const cpu = series(win, `${key}/cpu`, { base: (a.size === "large" ? 0.5 : a.size === "medium" ? 0.32 : 0.08) * a.replicas * busy, daily: 0.65, noise: 0.12 });
  const memory = series(win, `${key}/mem`, { base: limitPer * a.replicas * (name === "worker" ? 0.9 : 0.55), daily: 0.12, noise: 0.03 });
  return {
    ...win,
    cpu,
    memory,
    memoryLimit: memory.map((p) => ({ t: p.t, v: limitPer * a.replicas })),
    restarts: series(win, `${key}/restarts`, { base: 0, daily: 0, noise: 0 }).map((p, i, all) => ({ t: p.t, v: name === "worker" && i === Math.floor(all.length * 0.62) ? 1 : 0 })),
    requests: rpsBase ? series(win, `${key}/rps`, { base: rpsBase, daily: 0.75, noise: 0.1 }) : null,
    errors: rpsBase ? series(win, `${key}/err`, { base: rpsBase * 0.002, daily: 0.5, noise: 0.5, spikes: 0.03 }) : null,
    latencyP95: rpsBase ? series(win, `${key}/lat`, { base: name === "storefront" ? 0.21 : 0.12, daily: 0.3, noise: 0.15, spikes: 0.02 }) : null,
  };
}

const GiB = 1024 ** 3;

export function metricsOverview(nowMs, range, cluster) {
  const win = window_(range, nowMs);
  const staging = cluster === "hel1-staging";
  const nodes = staging
    ? [
        { name: "hel1-staging-cp-1", cpu: 0.9, cpuCapacity: 4, memory: 3.1 * GiB, memoryCapacity: 8 * GiB, disk: 31 * GiB, diskCapacity: 80 * GiB },
        { name: "hel1-staging-workers-m4rt2", cpu: 1.1, cpuCapacity: 4, memory: 4.4 * GiB, memoryCapacity: 8 * GiB, disk: 38 * GiB, diskCapacity: 80 * GiB },
        { name: "hel1-staging-workers-x8kpz", cpu: 0.7, cpuCapacity: 4, memory: 3.6 * GiB, memoryCapacity: 8 * GiB, disk: 29 * GiB, diskCapacity: 80 * GiB },
      ]
    : [
        { name: "fsn1-cp-1", cpu: 1.38, cpuCapacity: 4, memory: 9.2 * GiB, memoryCapacity: 16 * GiB, disk: 61 * GiB, diskCapacity: 160 * GiB },
        { name: "fsn1-workers-7k2mx", cpu: 2.21, cpuCapacity: 4, memory: 5.6 * GiB, memoryCapacity: 8 * GiB, disk: 34 * GiB, diskCapacity: 80 * GiB },
        { name: "fsn1-workers-q9xdt", cpu: 1.84, cpuCapacity: 4, memory: 4.9 * GiB, memoryCapacity: 8 * GiB, disk: 29 * GiB, diskCapacity: 80 * GiB },
        { name: "ax42-db-1", cpu: 2.9, cpuCapacity: 16, memory: 38.5 * GiB, memoryCapacity: 64 * GiB, disk: 0.61 * 1024 * GiB, diskCapacity: 2 * 954 * GiB },
      ];
  const cpuUsed = nodes.reduce((s, n) => s + n.cpu, 0);
  const memUsed = nodes.reduce((s, n) => s + n.memory, 0);
  const topApps = staging
    ? [
        { project: "shop-staging", app: "storefront", cpu: 0.11, memory: 210 * 1024 ** 2 },
        { project: "shop-staging", app: "api", cpu: 0.07, memory: 160 * 1024 ** 2 },
        { project: "shop-staging", app: "postgres", cpu: 0.05, memory: 420 * 1024 ** 2 },
      ]
    : [
        { project: "shop", app: "postgres", cpu: 0.62, memory: 3.4 * GiB },
        { project: "shop", app: "api", cpu: 0.88, memory: 1.1 * GiB },
        { project: "shop", app: "storefront", cpu: 0.71, memory: 0.92 * GiB },
        { project: "internal", app: "metabase", cpu: 0.19, memory: 1.6 * GiB },
        { project: "shop", app: "worker", cpu: 0.34, memory: 0.47 * GiB },
        { project: "shop", app: "redis", cpu: 0.06, memory: 0.31 * GiB },
        { project: "shop", app: "payments", cpu: 0.09, memory: 0.21 * GiB },
        { project: "internal", app: "handbook", cpu: 0.01, memory: 0.09 * GiB },
      ];
  const namespaces = [
    { namespace: "kwerft-system", cpu: 0.21, memory: 0.62 * GiB },
    { namespace: "kwerft-observability", cpu: 0.48, memory: 2.3 * GiB },
    { namespace: "kube-system", cpu: 0.36, memory: 1.1 * GiB },
    { namespace: "kwerft-gateway", cpu: 0.12, memory: 0.28 * GiB },
    { namespace: "kwerft-builds", cpu: 0.02, memory: 0.06 * GiB },
  ];
  return {
    ...win, scope: "all", nodes,
    platform: { cpu: namespaces.reduce((s, n) => s + n.cpu, 0), memory: namespaces.reduce((s, n) => s + n.memory, 0), namespaces },
    topApps,
    series: {
      cpu: series(win, `${cluster}/cpu`, { base: cpuUsed * 0.95, daily: 0.6, noise: 0.07 }),
      memory: series(win, `${cluster}/mem`, { base: memUsed * 0.98, daily: 0.06, noise: 0.015 }),
    },
  };
}

export function metricsQuery(nowMs, range, query) {
  const win = window_(range, nowMs);
  const ns = [["shop", 5.9 * GiB], ["internal", 1.7 * GiB], ["kwerft-observability", 2.3 * GiB], ["kube-system", 1.1 * GiB], ["kwerft-system", 0.62 * GiB]];
  return {
    ...win, query, scope: "all", truncated: false,
    series: ns.map(([namespace, base]) => ({ labels: { namespace }, points: series(win, `q/${namespace}`, { base, daily: 0.08, noise: 0.02 }) })),
  };
}

// ---- jobs -----------------------------------------------------------------------

function nextAt(now, hour, minute, everyHours) {
  const d = new Date(now);
  if (everyHours) {
    const n = new Date(now);
    n.setMinutes(minute, 0, 0);
    while (n.getTime() <= now || n.getHours() % everyHours !== hour % everyHours) n.setTime(n.getTime() + HOUR * 1000);
    return n.toISOString();
  }
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function lastAt(now, hour, minute, everyHours) {
  const next = new Date(nextAt(now, hour, minute, everyHours)).getTime();
  return next - (everyHours ? everyHours * HOUR : DAY) * 1000;
}

export function tasks(now) {
  const t = (name, project, o) => ({ name, project, cluster: "local", overrides: [], restart: [], ...o });
  const backupLast = lastAt(now, 2, 30);
  const reportLast = lastAt(now, 5, 15);
  const cartsLast = lastAt(now, 0, 0, 6);
  const sitemapLast = lastAt(now, 4, 0);
  const iso = (ms) => new Date(ms).toISOString();
  const plus = (ms, s) => new Date(ms + s * 1000).toISOString();
  return [
    t("db-migrate-x7k2p", "shop", { phase: "running", fromApp: "api", image: imageOf(appDefs[1]), startedBy: "jonas@example.com", created: ago(now, 75), started: ago(now, 68) }),
    t(`cleanup-carts-${Math.floor(cartsLast / 60000)}`, "shop", { phase: "succeeded", schedule: "cleanup-carts", fromApp: "api", image: imageOf(appDefs[1]), scheduledAt: iso(cartsLast), created: iso(cartsLast), started: plus(cartsLast, 4), finished: plus(cartsLast, 41), exitCode: 0 }),
    t(`nightly-report-${Math.floor(reportLast / 60000)}`, "internal", { phase: "failed", reason: "Failed", schedule: "nightly-report", image: "ghcr.io/example-shop/report-builder:2.3.1", scheduledAt: iso(reportLast), created: iso(reportLast), started: plus(reportLast, 6), finished: plus(reportLast, 258), exitCode: 1, message: "Exit code 1" }),
    t(`sitemap-${Math.floor(sitemapLast / 60000)}`, "shop", { phase: "succeeded", schedule: "sitemap", fromApp: "storefront", image: imageOf(appDefs[0]), scheduledAt: iso(sitemapLast), created: iso(sitemapLast), started: plus(sitemapLast, 5), finished: plus(sitemapLast, 96), exitCode: 0, restart: [] }),
    t(`db-backup-${Math.floor(backupLast / 60000)}`, "shop", { phase: "succeeded", schedule: "db-backup", fromApp: "postgres", image: "postgres:17.6", scheduledAt: iso(backupLast), created: iso(backupLast), started: plus(backupLast, 3), finished: plus(backupLast, 252), exitCode: 0 }),
    t("import-products-q4m8z", "shop", { phase: "succeeded", fromApp: "worker", image: imageOf(appDefs[3]), startedBy: "priya@example.com", overrides: ["SUPPLIER"], created: ago(now, 7 * HOUR), started: ago(now, 7 * HOUR - 5), finished: ago(now, 7 * HOUR - 312), exitCode: 0 }),
    t(`cleanup-carts-${Math.floor((cartsLast - 6 * HOUR * 1000) / 60000)}`, "shop", { phase: "succeeded", schedule: "cleanup-carts", fromApp: "api", image: imageOf(appDefs[1]), scheduledAt: iso(cartsLast - 6 * HOUR * 1000), created: iso(cartsLast - 6 * HOUR * 1000), started: plus(cartsLast - 6 * HOUR * 1000, 4), finished: plus(cartsLast - 6 * HOUR * 1000, 38), exitCode: 0 }),
    t(`nightly-report-${Math.floor((reportLast - DAY * 1000) / 60000)}`, "internal", { phase: "succeeded", schedule: "nightly-report", image: "ghcr.io/example-shop/report-builder:2.3.1", scheduledAt: iso(reportLast - DAY * 1000), created: iso(reportLast - DAY * 1000), started: plus(reportLast - DAY * 1000, 6), finished: plus(reportLast - DAY * 1000, 231), exitCode: 0 }),
    t(`db-backup-${Math.floor((backupLast - DAY * 1000) / 60000)}`, "shop", { phase: "succeeded", schedule: "db-backup", fromApp: "postgres", image: "postgres:17.6", scheduledAt: iso(backupLast - DAY * 1000), created: iso(backupLast - DAY * 1000), started: plus(backupLast - DAY * 1000, 3), finished: plus(backupLast - DAY * 1000, 247), exitCode: 0 }),
    t("reindex-search-b2tkw", "shop", { phase: "succeeded", fromApp: "api", image: imageOf(appDefs[1], 2), startedBy: "tomas@example.com", restart: ["api"], created: ago(now, 30 * HOUR), started: ago(now, 30 * HOUR - 6), finished: ago(now, 30 * HOUR - 140), exitCode: 0 }),
  ];
}

export function schedules(now) {
  const runs = tasks(now);
  const last = (s) => runs.find((r) => r.schedule === s);
  const s = (name, project, o) => ({ name, project, cluster: "local", timeZone: "Europe/Berlin", suspend: false, concurrency: "Forbid", restart: [], active: [], phase: "scheduled", created: ago(now, 120 * DAY), ...o });
  return [
    s("db-backup", "shop", { schedule: "30 2 * * *", fromApp: "postgres", image: "postgres:17.6", nextRun: nextAt(now, 2, 30), lastScheduled: last("db-backup").created, lastSuccess: last("db-backup").finished, lastRun: last("db-backup") }),
    s("cleanup-carts", "shop", { schedule: "0 */6 * * *", fromApp: "api", image: imageOf(appDefs[1]), nextRun: nextAt(now, 0, 0, 6), lastScheduled: last("cleanup-carts").created, lastSuccess: last("cleanup-carts").finished, lastRun: last("cleanup-carts") }),
    s("sitemap", "shop", { schedule: "0 4 * * *", fromApp: "storefront", image: imageOf(appDefs[0]), restart: ["storefront"], nextRun: nextAt(now, 4, 0), lastScheduled: last("sitemap").created, lastSuccess: last("sitemap").finished, lastRun: last("sitemap") }),
    s("nightly-report", "internal", {
      schedule: "15 5 * * 1-5", image: "ghcr.io/example-shop/report-builder:2.3.1", nextRun: nextAt(now, 5, 15), lastScheduled: last("nightly-report").created,
      lastSuccess: runs.filter((r) => r.schedule === "nightly-report" && r.phase === "succeeded")[0].finished, lastFailure: last("nightly-report").finished, lastRun: last("nightly-report"),
    }),
    s("weekly-newsletter", "shop", { schedule: "0 9 * * 2", fromApp: "worker", image: imageOf(appDefs[3]), suspend: true, phase: "suspended", nextRun: undefined, lastScheduled: ago(now, 6 * DAY), lastSuccess: ago(now, 6 * DAY - 300) }),
  ];
}

export function volumes(now) {
  return [
    { name: "data-postgres-0", project: "shop", cluster: "local", size: "80Gi", class: "local-nvme", capacity: "80Gi", phase: "bound", usedBy: ["App/postgres"], created: ago(now, 178 * DAY) },
    { name: "data-redis-0", project: "shop", cluster: "local", size: "5Gi", class: "local-nvme", capacity: "5Gi", phase: "bound", usedBy: ["App/redis"], created: ago(now, 178 * DAY) },
    { name: "backups", project: "shop", cluster: "local", size: "200Gi", class: "hcloud-volume", capacity: "200Gi", phase: "bound", usedBy: ["Schedule/db-backup"], created: ago(now, 170 * DAY) },
    { name: "uploads", project: "shop", cluster: "local", size: "50Gi", class: "hcloud-volume", capacity: "50Gi", phase: "bound", usedBy: ["App/api", "App/worker"], created: ago(now, 150 * DAY) },
    { name: "reports", project: "internal", cluster: "local", size: "10Gi", class: "hcloud-volume", capacity: "10Gi", phase: "bound", usedBy: ["Schedule/nightly-report"], created: ago(now, 110 * DAY) },
  ];
}

export function domains(now) {
  const d = (hostname, project, app, cluster, o = {}) => ({
    name: hostname.replace(/\./g, "-"), project, app, cluster, hostname, listener: `https-${hostname.split(".")[0]}`,
    certificate: "valid", notAfter: ago(now, -(40 + (hash(hostname) % 45)) * DAY), created: ago(now, 120 * DAY), ...o,
  });
  return [
    d("shop.example.com", "shop", "storefront", "local"),
    d("api.shop.example.com", "shop", "api", "local"),
    d("bi.apps.example.com", "internal", "metabase", "local", { listener: "apps-wildcard" }),
    d("handbook.apps.example.com", "internal", "handbook", "local", { listener: "apps-wildcard" }),
    d("storefront.staging.example.com", "shop-staging", "storefront", "hel1-staging", { dns: { hostname: "storefront.staging.example.com", purpose: "app", project: "shop-staging", zone: "example.com", state: "Managed", values: ["203.0.113.41", "2001:db8:1a2::1"] } }),
    d("api.staging.example.com", "shop-staging", "api", "hel1-staging", { dns: { hostname: "api.staging.example.com", purpose: "app", project: "shop-staging", zone: "example.com", state: "Managed", values: ["203.0.113.41", "2001:db8:1a2::1"] } }),
  ];
}

export function task(now, project, name) {
  const s = tasks(now).find((t) => t.project === project && t.name === name);
  if (!s) return undefined;
  return {
    apiVersion: "kwerft.dev/v1alpha1", kind: "Task",
    metadata: { name, namespace: project, resourceVersion: "77123", generation: 1, creationTimestamp: s.created, labels: s.schedule ? { "kwerft.dev/schedule": s.schedule } : {} },
    spec: { ...(s.fromApp ? { fromApp: s.fromApp } : { source: { image: { ref: s.image } } }), command: s.schedule === "nightly-report" ? ["report-builder", "--since", "24h", "--out", "/reports"] : undefined, timeout: "1h0m0s", retries: 0 },
    status: { phase: s.phase[0].toUpperCase() + s.phase.slice(1), image: s.image, job: name, pod: `${name}-${podSuffix(name)}`, startTime: s.started, completionTime: s.finished, exitCode: s.exitCode },
  };
}

// ---- alerts -------------------------------------------------------------------

export function alerts(now, state) {
  const base = { labels: {}, cluster: "local" };
  if (state === "firing") {
    return [{
      ...base, fingerprint: "7d1c0f2a9e44b318", rule: "memory-high", severity: "warning", state: "firing",
      summary: "worker uses 93 % of its memory limit",
      description: "The memory of shop/worker has been above 90 % of its limit for 10 minutes. Replicas restart when they reach it.",
      project: "shop", app: "worker", labels: { alertname: "MemoryHigh", namespace: "shop", app: "worker", severity: "warning", "kwerft.dev/rule": "memory-high" },
      startsAt: ago(now, 23 * MIN), consoleURL: "https://console.example.com/apps/shop/worker?tab=metrics",
    }, {
      ...base, fingerprint: "3e8a51c7f0b29d64", rule: "volume-filling-up", severity: "warning", state: "firing",
      summary: "Volume backups is 86 % full", description: "shop/backups (200 GiB) grows by about 2.4 GiB a day and is full in about 12 days at this rate.",
      project: "shop", labels: { alertname: "VolumeFillingUp", namespace: "shop", persistentvolumeclaim: "backups", severity: "warning" },
      startsAt: ago(now, 3 * HOUR + 12 * MIN),
    }];
  }
  if (state === "silenced") {
    return [{
      ...base, fingerprint: "a90be3317c0d5521", rule: "certificate-expiring", severity: "warning", state: "silenced",
      summary: "The certificate of legacy.example.com expires in 9 days", description: "cert-manager has not renewed it; the old domain stays until the redirect is gone.",
      project: "shop", labels: { hostname: "legacy.example.com", severity: "warning" }, startsAt: ago(now, 2 * DAY), silencedUntil: ago(now, -5 * DAY),
      silencedBy: ["2f1e0c4b"],
    }];
  }
  return [
    { ...base, fingerprint: "c41f7e0b2a6d9c11", rule: "http-errors", severity: "warning", state: "resolved", summary: "api answered 6.2 % of requests with 5xx", description: "More than 5 % of requests failed over 5 minutes.", project: "shop", app: "api", labels: {}, startsAt: ago(now, 26 * HOUR), endsAt: ago(now, 26 * HOUR - 11 * MIN) },
    { ...base, fingerprint: "e02b9a77d1c35f40", rule: "schedule-failing", severity: "warning", state: "resolved", summary: "nightly-report failed", description: "The last run of internal/nightly-report failed.", project: "internal", labels: { schedule: "nightly-report" }, startsAt: ago(now, 3 * DAY), endsAt: ago(now, 2 * DAY) },
    { ...base, fingerprint: "9b3d6e1f04a87c25", rule: "restarts", severity: "warning", state: "resolved", summary: "payments restarted 6 times in 15 minutes", description: "More than 5 restarts in 15 minutes.", project: "shop", app: "payments", labels: {}, startsAt: ago(now, 4 * DAY), endsAt: ago(now, 4 * DAY - 25 * MIN) },
    { ...base, fingerprint: "1a5c8f3e7b20d964", rule: "node-disk-pressure", severity: "critical", state: "resolved", summary: "fsn1-workers-q9xdt has 7 % of its disk free", description: "Less than 10 % of the disk free for 5 minutes.", labels: { node: "fsn1-workers-q9xdt" }, startsAt: ago(now, 9 * DAY), endsAt: ago(now, 9 * DAY - 48 * MIN) },
  ];
}

export function alertRules() {
  const r = (name, condition, severity, o = {}) => ({
    name, condition, severity, scope: { projects: [], apps: [] }, channels: ["ops-slack"], disabled: false, default: true, firing: 0, ready: true,
    effectiveExpr: `kwerft:alert:${name}`, cluster: "local", ...o,
  });
  return [
    r("crash-looping", "CrashLooping", "critical", { channels: ["ops-slack", "on-call"] }),
    r("restarts", "Restarts", "warning"),
    r("memory-high", "MemoryHigh", "warning", { firing: 1 }),
    r("volume-filling-up", "VolumeFillingUp", "warning", { firing: 1 }),
    r("node-memory-pressure", "NodeMemoryPressure", "critical", { channels: ["ops-slack", "on-call"] }),
    r("node-disk-pressure", "NodeDiskPressure", "critical", { channels: ["ops-slack", "on-call"] }),
    r("certificate-expiring", "CertificateExpiring", "warning"),
    r("schedule-failing", "ScheduleFailing", "warning", { channels: ["ops-slack", "team-email"] }),
    r("build-failing", "BuildFailing", "warning"),
    r("http-errors", "HTTPErrorRate", "warning", { default: false, threshold: 5, window: "5m0s", for: "5m0s", scope: { projects: ["shop"], apps: [] }, channels: ["ops-slack", "on-call"] }),
    r("checkout-latency", "HTTPLatency", "warning", { default: false, threshold: 800, window: "5m0s", for: "10m0s", scope: { projects: [], apps: ["shop/storefront", "shop/api"] } }),
  ];
}

export function channels(now) {
  return [
    { name: "ops-slack", type: "slack", slack: { channel: "#shop-ops" }, sendResolved: true, secretSet: true, ready: true, lastTest: ago(now, 12 * DAY) },
    { name: "on-call", type: "ntfy", ntfy: { server: "https://ntfy.example.com", topic: "shop-oncall" }, sendResolved: true, secretSet: true, ready: true, lastTest: ago(now, 40 * DAY) },
    { name: "team-email", type: "email", email: { to: ["ops@example.com"], from: "kwerft@example.com", smtpHost: "smtp.example.com:587", username: "kwerft@example.com" }, sendResolved: false, secretSet: true, ready: true },
  ];
}

const podNames = {
  storefront: ["storefront-6c8d9f7b5-x2kqp", "storefront-6c8d9f7b5-m7wzt", "storefront-6c8d9f7b5-r4hnc"],
  api: ["api-58f4c6d9b-tq8vd", "api-58f4c6d9b-j2lsm", "api-58f4c6d9b-w9fkr"],
  worker: ["worker-7b9d5c8f4-pz6nh", "worker-7b9d5c8f4-g3kbx"],
  payments: ["payments-5d7c9b6f8-h8rqz", "payments-5d7c9b6f8-c2vmn"],
  postgres: ["postgres-0"],
  metabase: ["metabase-6f9b8c7d5-k4tzq"],
};

// ---- logs ------------------------------------------------------------------------

const products = ["SKU-10482", "SKU-20017", "SKU-31108", "SKU-40930", "SKU-51262", "SKU-60341"];

export function logEntries(nowMs, { project, app, level, query, limit = 200 }) {
  const r = rng(424242);
  const entries = [];
  const gen = [
    ["api", "info", () => { const o = 100480 + Math.floor(r() * 900); return `{"level":"info","msg":"order created","order":"ORD-${o}","items":${1 + Math.floor(r() * 4)},"total_eur":${(19 + r() * 180).toFixed(2)},"duration_ms":${18 + Math.floor(r() * 60)}}`; }],
    ["api", "info", () => `{"level":"info","method":"GET","path":"/v2/products/${products[Math.floor(r() * products.length)]}","status":200,"duration_ms":${6 + Math.floor(r() * 30)}}`],
    ["storefront", "info", () => `GET /checkout 200 ${80 + Math.floor(r() * 120)}ms`],
    ["storefront", "info", () => `GET /products/${["linen-shirt", "canvas-tote", "wool-socks", "rain-jacket", "leather-belt"][Math.floor(r() * 5)]} 200 ${40 + Math.floor(r() * 90)}ms`],
    ["worker", "info", () => { const o = 100480 + Math.floor(r() * 900); return `job=send-order-confirmation order=ORD-${o} to=customer-${1000 + Math.floor(r() * 8000)}@example.net status=sent`; }],
    ["worker", "info", () => { const o = 100480 + Math.floor(r() * 900); return `job=render-invoice order=ORD-${o} pages=1 duration=${(0.4 + r()).toFixed(2)}s`; }],
    ["payments", "info", () => { const o = 100480 + Math.floor(r() * 900); return `payment captured order=ORD-${o} method=${["card", "paypal", "klarna", "sepa"][Math.floor(r() * 4)]} psp_ref=pi_${podSuffix(String(r()), 10)}`; }],
    ["api", "warn", () => `{"level":"warn","msg":"slow query","query":"SELECT … FROM order_items WHERE order_id = $1","duration_ms":${410 + Math.floor(r() * 300)}}`],
    ["worker", "warn", () => `job=sync-stock supplier=northwind retry=2 err="upstream 503, retrying in 30s"`],
    ["payments", "error", () => { const o = 100480 + Math.floor(r() * 900); return `payment declined order=ORD-${o} code=insufficient_funds`; }],
    ["api", "error", () => `{"level":"error","msg":"order update failed","order":"ORD-${100480 + Math.floor(r() * 900)}","err":"context deadline exceeded"}`],
  ];
  const weights = [16, 12, 10, 10, 9, 6, 7, 3, 2, 1.5, 1];
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = nowMs - 2000;
  for (let i = 0; i < 600; i++) {
    let x = r() * sum;
    let k = 0;
    while (x > weights[k]) x -= weights[k++];
    const [a, lvl, f] = gen[k];
    const p = podNames[a][Math.floor(r() * podNames[a].length)];
    entries.push({
      time: new Date(t).toISOString(), namespace: "shop", project: "shop", app: a, pod: p, container: a,
      stream: lvl === "info" ? "stdout" : "stderr", level: lvl, line: f(),
    });
    t -= 1500 + r() * 9000;
  }
  let out = entries;
  if (project && project !== "shop") out = [];
  if (app) out = out.filter((e) => e.app === app);
  if (level === "warn") out = out.filter((e) => e.level === "warn" || e.level === "error");
  if (level === "error") out = out.filter((e) => e.level === "error");
  if (query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/^"|"$/g, ""));
    out = out.filter((e) => words.every((w) => (w.includes(":") ? true : e.line.toLowerCase().includes(w))));
  }
  out = out.slice(0, limit).reverse(); // oldest first
  return out;
}

// ---- infrastructure ------------------------------------------------------------------

export function clusters(now) {
  return [
    {
      name: "local", displayName: "Production · Falkenstein", provider: "local", phase: "Connected", connected: true, hasToken: false,
      nodes: 4, readyNodes: 4, kubernetesVersion: "v1.34.1+k3s1", agentVersion: "0.5.0", createdAt: ago(now, 182 * DAY),
      pools: [
        { name: "local-workers", role: "worker", serverType: "cx33", location: "fsn1", count: 2, readyNodes: 2 },
        { name: "local-builds", role: "builds", serverType: "ccx23", location: "fsn1", count: 2, readyNodes: 0 },
      ],
    },
    {
      name: "hel1-staging", displayName: "Staging · Helsinki", provider: "hetzner-cloud", hetznerCloud: { location: "hel1", serverType: "cx33", controlPlanes: 1 },
      phase: "Connected", connected: true, hasToken: true, nodes: 3, readyNodes: 3, kubernetesVersion: "v1.34.1+k3s1", agentVersion: "0.5.0",
      lastSeen: ago(now, 4), createdAt: ago(now, 61 * DAY), agent: { remote: "203.0.113.41:41872", since: ago(now, 6 * DAY + 3 * HOUR) },
      pools: [
        { name: "hel1-staging-control-plane", role: "control-plane", serverType: "cx33", location: "hel1", count: 1, readyNodes: 1 },
        { name: "hel1-staging-workers", role: "worker", serverType: "cx33", location: "hel1", count: 2, readyNodes: 2 },
      ],
      publicAddresses: ["203.0.113.41", "2001:db8:1a2::1"],
      [SHOW_CLUSTER_CLOUD ? "cloud" : "_cloud"]: {
        firewall: "sync", loadBalancer: { enabled: false },
        status: {
          servers: [
            { node: "hel1-staging-cp-1", id: 58120411, name: "hel1-staging-cp-1", location: "hel1", labelled: true },
            { node: "hel1-staging-workers-m4rt2", id: 58120533, name: "hel1-staging-workers-m4rt2", location: "hel1", labelled: true },
            { node: "hel1-staging-workers-x8kpz", id: 58120534, name: "hel1-staging-workers-x8kpz", location: "hel1", labelled: true },
          ],
          firewall: { state: "InSync", id: 1834620, name: "kwerft-hel1-staging", rules: 7, servers: 3, revision: "r9" },
          syncedAt: ago(now, 40),
        },
      },
      dns: {
        records: [
          { hostname: "storefront.staging.example.com", purpose: "app", project: "shop-staging", zone: "example.com", state: "Managed", values: ["203.0.113.41", "2001:db8:1a2::1"] },
          { hostname: "api.staging.example.com", purpose: "app", project: "shop-staging", zone: "example.com", state: "Managed", values: ["203.0.113.41", "2001:db8:1a2::1"] },
        ],
        syncedAt: ago(now, 3 * MIN),
      },
    },
  ];
}

export function clusterNodes(now, cluster) {
  if (cluster === "hel1-staging") {
    const s = (name, ip, pub) => ({ name, serverId: 58120000 + (hash(name) % 999), publicIp: pub, privateIp: ip, serverType: "cx33", phase: "Ready" });
    return {
      cluster, provider: "hetzner-cloud", reachable: true, joinable: true, cloud: true, controlPlanes: 1,
      pools: [
        { name: "hel1-staging-control-plane", pool: "control-plane", role: "control-plane", serverType: "cx33", location: "hel1", count: 1, desired: 1, ready: 1, labels: {}, deleting: false, state: "ready", servers: [s("hel1-staging-cp-1", "10.1.0.2", "203.0.113.41")] },
        { name: "hel1-staging-workers", pool: "workers", role: "worker", serverType: "cx33", location: "hel1", count: 2, desired: 2, ready: 2, labels: {}, deleting: false, state: "ready", servers: [s("hel1-staging-workers-m4rt2", "10.1.0.3", "203.0.113.42"), s("hel1-staging-workers-x8kpz", "10.1.0.4", "203.0.113.43")] },
      ],
      nodes: [
        node("hel1-staging-cp-1", ["control-plane", "worker"], "hel1-staging-control-plane", "10.1.0.2", "203.0.113.41", "4", "8 GiB", 61),
        node("hel1-staging-workers-m4rt2", ["worker"], "hel1-staging-workers", "10.1.0.3", "203.0.113.42", "4", "8 GiB", 61),
        node("hel1-staging-workers-x8kpz", ["worker"], "hel1-staging-workers", "10.1.0.4", "203.0.113.43", "4", "8 GiB", 35),
      ].map((n) => ({ ...n, created: ago(now, n.created * DAY) })),
    };
  }
  const s = (name, ip, pub, type = "cx33") => ({ name, serverId: 51000000 + (hash(name) % 99999), publicIp: pub, privateIp: ip, serverType: type, phase: "Ready" });
  return {
    cluster: "local", provider: "local", reachable: true, joinable: true, cloud: true, controlPlanes: 1,
    pools: [
      {
        name: "local-workers", pool: "workers", role: "worker", serverType: "cx33", location: "fsn1", count: 2, desired: 2, ready: 2, labels: {}, deleting: false, state: "ready",
        servers: [s("fsn1-workers-7k2mx", "10.0.0.3", "203.0.113.11"), s("fsn1-workers-q9xdt", "10.0.0.4", "203.0.113.12")],
      },
      { name: "local-builds", pool: "builds", role: "builds", serverType: "ccx23", location: "fsn1", count: 2, desired: 0, ready: 0, labels: { "kwerft.dev/builds": "true" }, scaleDownAfterMinutes: 15, deleting: false, state: "ready", servers: [] },
    ],
    nodes: [
      node("fsn1-cp-1", ["control-plane", "worker"], undefined, "10.0.0.2", "203.0.113.10", "4", "16 GiB", 182),
      node("fsn1-workers-7k2mx", ["worker"], "local-workers", "10.0.0.3", "203.0.113.11", "4", "8 GiB", 150),
      node("fsn1-workers-q9xdt", ["worker"], "local-workers", "10.0.0.4", "203.0.113.12", "4", "8 GiB", 150),
      { ...node("ax42-db-1", ["worker"], undefined, "10.0.1.2", "198.51.100.42", "16", "64 GiB", 96), platform: "dedicated · AX42" },
    ].map((n) => ({ ...n, created: ago(now, n.created * DAY) })),
  };
}

function node(name, roles, pool, internalIp, externalIp, cpu, memory, created) {
  return {
    name, roles, pool, ready: true, status: "Ready", internalIp, externalIp, kubeletVersion: "v1.34.1+k3s1", os: "Ubuntu 24.04.3 LTS",
    cpu, memory, platform: name.startsWith("ax42") ? "dedicated" : "hcloud", unschedulable: false, created,
  };
}

export function catalog() {
  const t = (name, cores, memory, disk, cpuType, price) => ({
    name, description: name.toUpperCase(), cores, memory, disk, cpuType, architecture: name.startsWith("cax") ? "arm" : "x86",
    locations: ["fsn1", "nbg1", "hel1"], prices: { fsn1: price, nbg1: price, hel1: price },
  });
  return {
    locations: [
      { name: "fsn1", city: "Falkenstein", country: "DE", networkZone: "eu-central" },
      { name: "nbg1", city: "Nuremberg", country: "DE", networkZone: "eu-central" },
      { name: "hel1", city: "Helsinki", country: "FI", networkZone: "eu-central" },
    ],
    serverTypes: [
      t("cx23", 2, 4, 40, "shared", "3.49"), t("cx33", 4, 8, 80, "shared", "5.49"), t("cx43", 8, 16, 160, "shared", "9.49"),
      t("cax21", 4, 8, 80, "shared", "6.49"), t("ccx13", 2, 8, 80, "dedicated", "12.49"), t("ccx23", 4, 16, 160, "dedicated", "24.49"),
    ],
  };
}

export function firewall(now) {
  const rule = (name, port, protocol, sources, o = {}) => ({
    name, port, protocol, sources, nodes: "all", description: "", disabled: false, required: true, editable: "none", ready: true, reason: "Applied", cloudFirewall: "Applied", ...o,
  });
  return {
    rules: [
      rule("ssh", 22, "TCP", ["198.51.100.0/24", "2001:db8:4f00::/48"], { description: "SSH for the team (office and VPN)", editable: "sources" }),
      rule("http", 80, "TCP", [], { description: "HTTP, redirects to HTTPS and ACME challenges" }),
      rule("https", 443, "TCP", [], { description: "HTTPS for the console and apps" }),
      rule("wireguard", 51820, "UDP", ["10.0.0.0/16"], { description: "Pod network between nodes (Cilium WireGuard)", cloudFirewall: "Private" }),
      rule("icmp", 0, "ICMP", [], { description: "Ping and path MTU discovery" }),
      rule("cluster-private", 1, "TCP", ["10.0.0.0/16"], { endPort: 65535, description: "Everything on the private network", cloudFirewall: "Private" }),
      rule("kube-api", 6443, "TCP", ["198.51.100.0/24"], { required: false, editable: "all", nodes: "control-plane", description: "kubectl from the office" }),
      rule("sftp-supplier", 2222, "TCP", ["203.0.113.200/29"], { required: false, editable: "all", description: "Product feed uploads from Northwind Supply" }),
      rule("node-exporter", 9100, "TCP", ["198.51.100.20/32"], { required: false, editable: "all", disabled: true, cloudFirewall: "Disabled", description: "Old external monitoring, kept for a week" }),
    ],
    revision: "r42", confirmed: "r42", state: "in-sync", canRollBack: true,
    nodes: ["fsn1-cp-1", "fsn1-workers-7k2mx", "fsn1-workers-q9xdt", "ax42-db-1"].map((n, i) => ({ name: n, controlPlane: i === 0, state: "in-sync", updatedAt: ago(now, 18 + i * 7) })),
    client: { ip: "198.51.100.23", verifiable: true, ssh: true },
    cloud: { state: "InSync", id: 1834521, name: "kwerft-local", rules: 8, servers: 3, revision: "r42" },
  };
}

export function trafficFor(now, project) {
  const hubble = { state: "ok", since: ago(now, 6 * DAY), lost: 0, window: "1h" };
  if (project !== "shop") {
    return {
      project, isolated: true, hubble, drops: [],
      rules: project === "internal" ? [
        { name: "metabase-to-shop-db", description: "Reports read the shop database", disabled: false, from: [{ app: "metabase" }], to: [{ app: "shop/postgres" }], ports: [{ port: 5432, protocol: "TCP" }], phase: "ready", policies: ["kwerft-tr-metabase-to-shop-db"], counts: { allowed: 412, dropped: 0, since: ago(now, HOUR) }, generation: 2, created: ago(now, 90 * DAY) },
      ] : [],
    };
  }
  const rule = (name, description, from, to, ports, allowed, dropped = 0, o = {}) => ({
    name, description, disabled: false, from, to, ports, phase: "ready", policies: [`kwerft-tr-${name}`], counts: { allowed, dropped, since: ago(now, HOUR) }, generation: 1, created: ago(now, 60 * DAY), ...o,
  });
  return {
    project, isolated: true, hubble,
    rules: [
      rule("carrier-webhooks", "Shipping status updates from the carrier", [{ cidr: "203.0.113.128/26" }], [{ app: "api" }], [{ port: 8080, protocol: "TCP" }], 1840),
      rule("payments-psp", "Payment provider API", [{ app: "payments" }], [{ cidr: "198.51.100.64/27" }], [{ port: 443, protocol: "TCP" }], 2310),
      rule("smtp-relay", "Order mails through the mail relay", [{ app: "worker" }], [{ cidr: "198.51.100.25/32" }], [{ port: 587, protocol: "TCP" }], 655),
      rule("reports-read-db", "Metabase reads the shop database", [{ app: "internal/metabase" }], [{ app: "postgres" }], [{ port: 5432, protocol: "TCP" }], 412),
      rule("supplier-feed", "Stock sync with Northwind Supply", [{ app: "worker" }], [{ cidr: "203.0.113.200/29" }], [{ port: 443, protocol: "TCP" }, { port: 2222, protocol: "TCP" }], 96, 0),
      rule("legacy-erp", "Old ERP export, until December", [{ app: "worker" }], [{ cidr: "198.51.100.140/32" }], [{ port: 1433, protocol: "TCP" }], 0, 0, { disabled: true, phase: "disabled" }),
    ],
    drops: [
      {
        from: { namespace: "shop", app: "api", kind: "pod" }, to: { namespace: "shop", app: "payments", kind: "pod" }, port: 9090, protocol: "TCP", egress: false,
        count: 14, first: ago(now, 52 * MIN), last: ago(now, 4 * MIN),
        suggestion: { project: "shop", name: "api-to-payments-metrics", spec: { description: "api reads payment metrics", from: [{ app: "api" }], to: [{ app: "payments" }], ports: [{ port: 9090, protocol: "TCP" }] } },
      },
    ],
  };
}

export function trafficDrops(now) {
  const t = trafficFor(now, "shop");
  return { hubble: t.hubble, drops: t.drops };
}

// ---- settings ---------------------------------------------------------------------

export function settings(now, cluster = "local") {
  if (cluster === "hel1-staging") {
    return {
      cluster, consoleDomain: "console.example.com", appsDomain: "staging.example.com", tls: "dns01", dnsProvider: "hetzner", tokenSet: true, manageRecords: true,
      dnsRecords: [], wildcardDomain: undefined, publicAddresses: ["203.0.113.41", "2001:db8:1a2::1"],
      certificates: [
        { name: "storefront-staging", purpose: "apps-wildcard", hostnames: ["storefront.staging.example.com"], state: "valid", notAfter: ago(now, -71 * DAY) },
      ],
      ready: { status: true, reason: "Ready", message: "" },
      hcloud: { tokenSet: true, platform: "cloud", ccm: true, volumes: true, loadBalancerReady: true, firewall: "sync", loadBalancer: { enabled: false } },
      consoleAppsDomain: "apps.example.com", consoleRecords: true,
      clusterDNS: clusters(now)[1].dns,
    };
  }
  return {
    cluster: "local",
    consoleDomain: "console.example.com", appsDomain: "apps.example.com", tls: "dns01", dnsProvider: "hetzner", tokenSet: true, manageRecords: true,
    dnsRecords: [
      { hostname: "console.example.com", purpose: "console", zone: "example.com", state: "Managed", values: ["203.0.113.10", "2001:db8:10::1"] },
      { hostname: "*.apps.example.com", purpose: "apps", zone: "example.com", state: "Managed", values: ["203.0.113.10", "2001:db8:10::1"] },
      { hostname: "shop.example.com", purpose: "apps", zone: "example.com", state: "External", values: ["203.0.113.10"], message: "Points here; kept by hand at the registrar." },
    ],
    dnsSyncedAt: ago(now, 2 * MIN),
    wildcardDomain: "*.apps.example.com",
    publicAddresses: ["203.0.113.10", "2001:db8:10::1"],
    certificates: [
      { name: "console", purpose: "console", hostnames: ["console.example.com"], state: "valid", notAfter: ago(now, -58 * DAY) },
      { name: "apps-wildcard", purpose: "apps-wildcard", hostnames: ["*.apps.example.com"], state: "valid", notAfter: ago(now, -64 * DAY) },
    ],
    ready: { status: true, reason: "Ready", message: "" },
    hcloud: {
      tokenSet: true, platform: "cloud", ccm: true, volumes: true, loadBalancerReady: true, firewall: "sync",
      loadBalancer: { enabled: true, type: "lb11", location: "fsn1" },
      status: {
        servers: [
          { node: "fsn1-cp-1", id: 51004410, name: "fsn1-cp-1", location: "fsn1", labelled: true },
          { node: "fsn1-workers-7k2mx", id: 51006721, name: "fsn1-workers-7k2mx", location: "fsn1", labelled: true },
          { node: "fsn1-workers-q9xdt", id: 51006722, name: "fsn1-workers-q9xdt", location: "fsn1", labelled: true },
        ],
        firewall: { state: "InSync", id: 1834521, name: "kwerft-local", rules: 8, servers: 3, revision: "r42" },
        loadBalancer: { state: "Active", active: true, id: 2207713, name: "kwerft-local", type: "lb11", location: "fsn1", ipv4: "203.0.113.10", ipv6: "2001:db8:10::1", targets: 4, healthyTargets: 4 },
        syncedAt: ago(now, 45),
      },
    },
  };
}

export function gitConnections(now) {
  return [
    {
      name: "github-example-shop", provider: "github", url: "https://github.com", auth: "githubApp", owner: "example-shop", projects: [], account: "example-shop-kwerft[bot]",
      ready: true, webhookURL: "https://console.example.com/api/v1/git/hooks/github-example-shop", webhookAutomatic: true, lastDelivery: ago(now, 38 * MIN),
      githubApp: { appID: 1048213, installationID: 61822094, slug: "example-shop-kwerft" },
    },
    {
      name: "gitlab-agency", provider: "gitlab", url: "https://gitlab.example.com", auth: "token", owner: "design-agency", projects: ["shop"], account: "kwerft-builds",
      ready: true, webhookURL: "https://console.example.com/api/v1/git/hooks/gitlab-agency", webhookAutomatic: true, lastDelivery: ago(now, 4 * DAY),
    },
  ];
}

export function account(now) {
  return {
    user: ME, hasPassword: true, identities: [{ issuer: "https://accounts.google.com", email: "mara@example.com", linkedAt: ago(now, 90 * DAY), lastLoginAt: ago(now, 2 * DAY) }],
    totp: true, passkeys: [
      { id: "pk1", name: "MacBook Touch ID", createdAt: ago(now, 170 * DAY), lastUsedAt: ago(now, 2 * MIN) },
      { id: "pk2", name: "YubiKey 5C", createdAt: ago(now, 160 * DAY), lastUsedAt: ago(now, 20 * DAY) },
    ],
    recoveryCodesLeft: 9,
    sessions: [{ id: "s1", current: true, createdAt: ago(now, 2 * HOUR), lastSeenAt: ago(now, 5), ip: "198.51.100.23", userAgent: "Chrome on macOS" }],
    available: { totp: true, passkeys: true },
  };
}

// ---- access -------------------------------------------------------------------------

export function members(now) {
  return people.map((p) => ({
    id: p.id, name: p.name, email: p.email, role: p.role, createdAt: ago(now, p.joined), lastActive: ago(now, p.active),
    secondFactor: p.f, you: p.id === ME.id, manageable: p.id !== ME.id,
  }));
}

export function invites(now) {
  return [
    { id: "inv1", email: "noor@example.com", role: "developer", invitedBy: "Jonas Becker", invitedByEmail: "jonas@example.com", createdAt: ago(now, 26 * HOUR), expiresAt: ago(now, -6 * DAY), state: "open", sent: true, manageable: true },
  ];
}

export function audit(now) {
  const e = (s, actor, action, target, ip, detail = "") => ({ at: ago(now, s), actor, action, target, ip, detail });
  const list = [
    e(2 * MIN, "mara@example.com", "session.login", "mara@example.com", "198.51.100.23", "passkey"),
    e(9 * MIN, "tomas@example.com", "pod.exec.end", "shop/storefront-6c8d9f7b5-x2kqp", "198.51.100.57", "exited after 4m12s, recording rec-7f3a91, exit code 0"),
    e(13 * MIN, "tomas@example.com", "pod.exec", "shop/storefront-6c8d9f7b5-x2kqp", "198.51.100.57", "container storefront, auto, recording rec-7f3a91"),
    e(38 * MIN, "git:github-example-shop", "build.create", "shop/api-318", "192.0.2.10", `push of ${sha("shop/api/112").slice(0, 7)} (main) by sam-okafor`),
    e(75, "jonas@example.com", "task.create", "shop/db-migrate-x7k2p", "198.51.100.31", "from app api, command bin/migrate up"),
    e(47 * MIN, "jonas@example.com", "session.login", "jonas@example.com", "198.51.100.31", "passkey"),
    e(2 * HOUR + 14 * MIN, "git:github-example-shop", "build.create", "shop/storefront-142", "192.0.2.10", `push of ${sha("shop/storefront/48").slice(0, 7)} (main) by tomas-ortega`),
    e(3 * HOUR, "priya@example.com", "app.update", "shop/worker", "198.51.100.44", "generation 64"),
    e(5 * HOUR, "sam@example.com", "app.scale", "internal/handbook", "203.0.113.77", "replicas 2"),
    e(7 * HOUR, "priya@example.com", "task.create", "shop/import-products-q4m8z", "198.51.100.44", "from app worker, overrides SUPPLIER"),
    e(26 * HOUR, "jonas@example.com", "firewall.confirm", "r42", "198.51.100.31", "sftp-supplier added"),
    e(26 * HOUR + 3 * MIN, "jonas@example.com", "firewall.rule.create", "sftp-supplier", "198.51.100.31", "TCP 2222 from 203.0.113.200/29"),
    e(30 * HOUR, "tomas@example.com", "task.create", "shop/reindex-search-b2tkw", "198.51.100.57", "from app api, restart api"),
    e(2 * DAY, "mara@example.com", "alert.silence", "certificate-expiring", "198.51.100.23", "legacy.example.com for 7d"),
    e(3 * DAY, "jonas@example.com", "app.rollback", "shop/payments", "198.51.100.31", "to revision 18 (ghcr.io/example-shop/payments:2.8.0)"),
    e(3 * DAY + 4 * HOUR, "sam@example.com", "app.update", "shop/payments", "203.0.113.77", "generation 19"),
    e(4 * DAY, "mara@example.com", "member.invite", "noor@example.com", "198.51.100.23", "developer"),
    e(5 * DAY, "mara@example.com", "project.access", "internal", "198.51.100.23", "members only: priya, sam, lena"),
    e(6 * DAY, "jonas@example.com", "cluster.create", "hel1-staging", "198.51.100.31", "hetzner-cloud, hel1, cx33"),
  ];
  return list.sort((a, b) => b.at.localeCompare(a.at)).map((x, i) => ({ id: 9000 - i, ...x }));
}

export function recordings(now) {
  return [
    { id: "rec-7f3a91", user: "tomas@example.com", project: "shop", kind: "app", app: "storefront", pod: "storefront-6c8d9f7b5-x2kqp", container: "storefront", shell: "bash", ip: "198.51.100.57", started: ago(now, 13 * MIN), ended: ago(now, 9 * MIN), durationSeconds: 252, reason: "exited", exitCode: 0, bytes: 18400, inputRecorded: false },
    { id: "rec-51c0de", user: "jonas@example.com", project: "shop", kind: "task", task: "db-migrate-x7k2p", pod: "db-migrate-x7k2p-hq4zt", container: "task", shell: "sh", ip: "198.51.100.31", started: ago(now, 50), live: true, durationSeconds: 50, bytes: 4100, inputRecorded: false },
    { id: "rec-2b88e4", user: "priya@example.com", project: "shop", kind: "app", app: "postgres", pod: "postgres-0", container: "postgres", shell: "bash", ip: "198.51.100.44", started: ago(now, 2 * DAY), ended: ago(now, 2 * DAY - 11 * MIN), durationSeconds: 660, reason: "exited", exitCode: 0, bytes: 92300, inputRecorded: false },
    { id: "rec-9de017", user: "sam@example.com", project: "shop", kind: "app", app: "payments", pod: "payments-5d7c9b6f8-h8rqz", container: "payments", shell: "debug", debugContainer: "kwerft-debug-7k2", ip: "203.0.113.77", started: ago(now, 3 * DAY), ended: ago(now, 3 * DAY - 6 * MIN), durationSeconds: 356, reason: "idle", bytes: 7700, inputRecorded: false },
  ];
}

export function roles() {
  const g = (o, a, d, v, note) => ({ owner: { level: o }, admin: { level: a }, developer: { level: d, ...(d === "partial" && note ? { note } : {}) }, viewer: { level: v } });
  return {
    roles: [
      { role: "owner", group: "kwerft:role:owner", clusterRole: "kwerft:owner" },
      { role: "admin", group: "kwerft:role:admin", clusterRole: "kwerft:admin" },
      { role: "developer", group: "kwerft:role:developer", clusterRole: "kwerft:developer", projectRole: "kwerft:project-developer" },
      { role: "viewer", group: "kwerft:role:viewer", clusterRole: "kwerft:viewer", projectRole: "kwerft:project-viewer" },
    ],
    permissions: [
      { id: "apps.view", label: "View apps, logs and metrics", enforcedBy: "kubernetes", grants: g("yes", "yes", "yes", "yes") },
      { id: "apps.deploy", label: "Deploy, scale and roll back apps", enforcedBy: "kubernetes", grants: g("yes", "yes", "yes", "no") },
      { id: "shell", label: "Open shells (recorded)", enforcedBy: "kubernetes", grants: g("yes", "yes", "yes", "no") },
      { id: "projects", label: "Create projects and manage their access", enforcedBy: "kubernetes", grants: g("yes", "yes", "no", "no") },
      { id: "nodes", label: "Clusters, nodes and the server firewall", enforcedBy: "kubernetes", grants: g("yes", "yes", "no", "no") },
      { id: "members", label: "Invite and manage members", enforcedBy: "console", grants: g("yes", "partial", "no", "no") },
    ],
  };
}
