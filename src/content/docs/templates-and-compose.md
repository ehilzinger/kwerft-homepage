---
title: Templates & Compose
description: Start PostgreSQL, Redis, MinIO, n8n or Plausible from a template, or turn a Docker Compose file into apps, volumes and secret sets, with a review before anything is created.
group: Run apps
order: 3
---

Besides a single image or a Git repository, the deploy wizard has two more sources: a **Template** for common services, and **Docker Compose**, which turns a Compose file's services into apps. Both show what Kwerft will create and create nothing until you confirm.

<div class="note">Templates and the Compose import need Kwerft v0.6.0, which is in release candidates. The default install command installs v0.4.0; to try them, <a href="/docs/installer#pin-a-version">pin v0.6.0-rc.1</a>.</div>

You need the developer role (or owner or admin) in the project. Open **Apps**, click **Deploy app**, and choose the **Source**.

## Templates

**Template** offers ready-made setups. Each starts with pinned images, gets disks and generated passwords, and keeps its secrets in a [secret set](/docs/secrets) that other apps can use.

| Template | What you get |
|---|---|
| **PostgreSQL** | A PostgreSQL 18 server with a disk of its own. The password is generated; other apps connect with the `DATABASE_URL` key of its secret set. |
| **Redis** | A Redis 8 server with a generated password, persisting to a disk of its own. Other apps connect with `REDIS_URL`. |
| **MinIO** | S3-compatible object storage on a volume of the project, with a generated root password, and the S3 API and web console on public hostnames if you give them. It runs Silo, the maintained MinIO fork by Pigsty, since MinIO, Inc. no longer publishes images. |
| **n8n** | The n8n workflow tool on a public hostname, with its own PostgreSQL. The database password and n8n's encryption key are generated. |
| **Plausible Analytics** | Plausible Community Edition on a public hostname, with its PostgreSQL and ClickHouse. All passwords and the secret key base are generated. |

1. Pick a template.
2. Fill in its **Settings**: the **App name** (also its hostname inside the project and the name of its secret set), disk sizes and classes, and, depending on the template, a size, a hostname, or **Apps that may connect** (`api`, or `shop/api` for another project). n8n and Plausible need a **Hostname**, which needs DNS pointing at the server or an [apps domain](/docs/domains-and-tls#the-apps-domain).
3. **Review** lists what Kwerft will create, with the public URLs, and the template's notes on what to do next.
4. Click **Create &lt;template&gt;**.

The apps start with generated values already in place. Database templates keep their data on a disk of their own (Local NVMe by default, which cannot grow later; a Hetzner Cloud Volume can). n8n and Plausible start without a health check, because their first start runs migrations that take longer than a check would wait.

To connect your own app to a template's database, pick the template's set and key (for example `postgres · DATABASE_URL`) as the variable's **Source** in your app's **Settings › Environment**, and allow your app under the database's **Who may connect to this app inside the cluster?**, unless you named it in **Apps that may connect**.

## Docker Compose

**Docker Compose** turns a Compose file into apps: each service becomes an app, named volumes become volumes.

1. Paste the file, or **Upload…** one (up to 256 KiB).
2. If the file uses `${VAR}` references, give their values under **Values for `${VAR}` references** (KEY=value, like a `.env` file). They are used only to fill in the file.
3. Click **Check**. Kwerft converts the file and checks every object as you, without creating anything.
4. The review shows **Kwerft will create** (apps, volumes and secret sets in the order they are created, with public URLs), names it had to change under **Renamed to valid names**, warnings per service, and any problems that block the import.
5. Click **Create N apps**.

Everything is created in one go. If any step fails, what was already created is removed again, so a failed import leaves nothing behind.

### What is converted

| Compose | In Kwerft |
|---|---|
| `image` | The app's image. Images without a version tag get a note. |
| `build` with a Git URL as context | An app [built from Git](/docs/builds). A local `build` with an `image` deploys the image; without one, the service is skipped. |
| `entrypoint`, `command` | The app's command and its arguments. |
| `environment` (map or list) | Environment variables. Names that look secret (`PASSWORD`, `SECRET`, `TOKEN`, `KEY` and the like) and URLs with a password in them go write-only into the app's own secret set. |
| `ports` (short and long syntax), `expose` | Ports inside the cluster. A published HTTP port gets the public hostname `<app>.<apps domain>`; 443, ports bound to `127.0.0.1`, and well-known non-HTTP ports such as 5432 or 6379 stay inside. |
| Named volumes | Shared volumes of 5 GiB on Local NVMe, mounted where the service had them (`:ro` kept). `external` volumes mount an existing volume. |
| `deploy.replicas`, `scale` | Replicas. |
| Memory limits (`deploy.resources`, `mem_limit`) | The smallest size that fits. |
| `healthcheck` | `curl` or `wget` against localhost become an HTTP check; `nc -z`, `pg_isready`, `redis-cli` and the like a TCP check. Others are left out with a warning. |
| `networks` | Services that share a network may connect to each other (all of them on Compose's default network). A service only on `internal: true` networks gets no outbound access. |

Variable interpolation, YAML anchors and merges work. Outbound access stays Kwerft's default (HTTPS to the internet), not Compose's unrestricted network.

Without an apps domain, nothing gets a public hostname; the review warns once per service. Add hostnames later under the app's **Settings › Ports**.

### Not supported

These keys are reported as warnings and left out: `depends_on`, `privileged`, `cap_add`, `devices`, `network_mode`, `user`, `working_dir`, `secrets` and `configs`, `env_file`, `links`, `extends`, `restart: "no"`, `include`, volume drivers, bind mounts, `tmpfs` and anonymous volumes. A service with `profiles` is skipped.

Apps in Kwerft start in no particular order, so a service that needs its database must retry until it answers.

### x-kwerft

An `x-kwerft` block adds Kwerft-specific settings:

```yaml
services:
  web:
    image: ghcr.io/acme/web:1.4.2
    ports: ["8080:3000"]
    x-kwerft:
      size: medium           # small, medium or large
      egress: all            # none, https or all
      public: shop.example.com   # a hostname, or false to keep it inside
volumes:
  db-data:
    x-kwerft:
      size: 20Gi
      class: hcloud-volume   # or local-nvme
```

## Limits

- Templates come from a fixed catalog of five; you cannot add your own yet.
- Templates and imports create apps without a health check where a slow first start would trip it.
- The Compose import covers the parts of Compose that map onto apps; the review says what it left out.
