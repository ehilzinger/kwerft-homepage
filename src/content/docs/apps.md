---
title: Apps
description: Deploy a container image, set environment variables, ports and public hostnames, mount volumes, scale, roll back, and read logs or open a shell.
group: Run apps
order: 1
---

An app is a long-running service in a project: an image from any registry, or a Git repository that Kwerft builds for you. This page covers deploying from an image and everything you do with an app afterwards. For apps built from Git, see [Builds from Git](/docs/builds); for templates and Docker Compose files, see [Templates & Compose](/docs/templates-and-compose).

You need the developer role (or owner or admin) in the project to deploy and change apps. Viewers see everything but cannot change it.

## Create a project first

Apps live in projects. If the Apps page says **Start with a project**, an owner or admin creates one with **New project**: a name (lowercase letters, digits and dashes; it becomes the Kubernetes namespace and cannot change), an optional display name and, with more than one cluster, the cluster it runs in.

## Deploy from a registry image

1. Open **Apps** and click **Deploy app**.
2. **Source:** choose **Container image**. Enter the **App name** (it is also the in-cluster hostname), the **Project** and the **Image**, for example `ghcr.io/acme/invoice-renderer:0.3.0`. Pin a version tag or a digest rather than `latest`, so a rollback runs something different.
3. For a private image, enter the name of a docker-registry Secret in the project under **Registry credential** (see [Secrets](#secrets) below).
4. **Runtime:** pick a size, the number of replicas, a health check, environment variables, secret variables, and shared volumes and secrets.
5. **Networking:** enter the **Container port**, choose **Cluster only** or **Public domain**, and decide who may connect and what the app may reach.
6. **Review:** check the App resource (**Copy YAML** keeps a copy) and the list of objects Kwerft will create, then click **Deploy &lt;name&gt;**.

The app opens on its Overview tab while the first replica starts.

The wizard's other sources are **Git repository** ([Builds from Git](/docs/builds)), and, from v0.6.0, **Docker Compose** and **Template** ([Templates & Compose](/docs/templates-and-compose)). In v0.4.0 and the v0.5.0 release candidates, Compose and templates are shown as **Later**.

## Environment variables

In the wizard, enter one `KEY=value` per line. Afterwards, edit them on the app's **Settings** tab under **Environment**: **Add variable**, change a value, or **Remove**.

Plain values are stored in the App resource and are readable by everyone with access to the project. Do not put passwords there: use secrets.

### Secrets

<div class="note">Secret variables need Kwerft v0.6.0, which is in release candidates. For v0.4.0 and v0.5.0, see <a href="#before-v060">Before v0.6.0</a> below.</div>

Each variable on the **Environment** card has a **Source**:

- **Plain:** a value in the App resource.
- **Secret · this app:** a write-only value in the app's own secret set, `<app>-env`. After saving it shows dots; type to replace it.
- A key of one of the project's [secret sets](/docs/secrets), listed under **Set &lt;name&gt;**, for values that several apps share.

In the wizard, **Secret variables (KEY=value, one per line)** go into the app's own set. Changing a secret value rolls the app without a new revision. Owners and admins can **Reveal** a value after their password. See [Secrets](/docs/secrets) for generated values, sets shared by several apps, and how values are protected.

#### Before v0.6.0

v0.4.0 and v0.5.0 have no secret store. Keep sensitive values in a Kubernetes Secret and reference it:

1. On the server, as root, create the Secret in the project's namespace, for example `sudo k3s kubectl -n shop create secret generic payments --from-literal=STRIPE_KEY=…`.
2. Reference it in the App's YAML with `valueFrom.secretKeyRef` and apply it with kubectl.

The Settings tab then shows the variable as `secret · payments/STRIPE_KEY` and keeps it when you save. The console and downloaded kubeconfigs never read Secrets, so this step needs root on the server.

The docker-registry Secret behind **Registry credential** is still created this way in v0.6.0, since secret sets cannot hold one yet: `sudo k3s kubectl -n shop create secret docker-registry ghcr --docker-server=ghcr.io --docker-username=… --docker-password=…`.

## Ports and public hostnames

The **Container port** is the port your app listens on. Leave it empty for workers that only connect out.

- **Cluster only:** other apps reach it at `<app>.<project>.svc:<port>`, if they are allowed to (below).
- **Public domain:** Kwerft adds an HTTPS listener for the hostname, gets a Let's Encrypt certificate and redirects HTTP to HTTPS. If an apps domain is set in Settings, the wizard suggests `<app>.<apps domain>`. See [Domains & TLS](/docs/domains-and-tls) for DNS and certificates.

To add more ports or change hostnames later, use **Settings › Ports**: each row is a container port with an optional **Public hostname** (empty means cluster only). A hostname cannot be claimed by two apps; the older claim wins.

To serve one port under several hostnames, for example while a site moves to a new name, add a row with the same container port and the other hostname. Each hostname gets its own certificate and route, and the app's page lists each under **Reachable at**. The same hostname cannot point at two ports. This needs v0.6.0; earlier releases refuse a port listed twice.

### Who may connect, and where the app may go

- **Who may connect to this app inside the cluster?** lists apps by name (`api`) or as `project/app`. Everything else is denied, except traffic for the app's public hostname, which is always allowed. For more, use [traffic rules](/docs/network#traffic-rules).
- **Outbound access:** **None**, **HTTPS to internet** (the default: TCP 443 to public addresses) or **Unrestricted**.

## Volumes

Shared volumes are disks of a project that apps and jobs mount by name.

1. Open **Apps › Volumes** and click **New volume**.
2. Enter a **Name**, the **Project** and a **Size (GiB)** (a plain number means GiB; `500Mi` works too).
3. Choose the **Class**:
   - **Local NVMe:** fastest, pinned to the node it was created on, cannot grow. It shows **Waits for first mount** until an app or job uses it.
   - **Hetzner Cloud Volume:** moves between Cloud nodes and can grow. Offered only where Cloud Volumes are set up (see [Clusters & nodes](/docs/clusters-and-nodes#cloud-volumes)).

To mount one, use **Mount a volume** in the deploy wizard or under **Settings › Volumes**: a path, the volume, and optionally **Read-only**. Every pod that mounts a volume runs on the same node. **Resize** grows a Cloud Volume online; volumes never shrink. A volume that is still mounted is not deleted until nothing uses it.

**Mount a secret as files** (v0.6.0), in the same place, mounts a secret read-only, one file per key: a path, the secret's name (a [secret set](/docs/secrets#mount-a-secret-as-files) works), and the permission, **Readable by all (0444)** or **Owner only (0400)**. Until the secret exists, new replicas wait.

An app can also have a disk per replica, which makes it a StatefulSet. There is no form for that yet: add `volumes: [{path: /data, size: 10Gi}]` to the App's YAML. The Settings tab shows such disks but cannot change them.

## Replicas and resources

- **Size:** **Small** (0.25 vCPU, 256 MiB), **Medium** (0.5 vCPU, 512 MiB) or **Large** (1 vCPU, 2 GiB). For other values, set `size: custom` and `resources` in the YAML.
- **Replicas:** set in the wizard, under **Settings › Scaling & resources**, or with **Scale** on the app's page. Replicas spread across nodes when possible. **0** stops the app without deleting it.

## Health and draining

Under **Settings › Health & draining**:

- **Check:** **None**, **HTTP GET** (a path and port) or **TCP connect** (a port). With a check, a new replica gets traffic only once it passes, and a hung one is replaced. Without one, a replica counts as ready as soon as its container starts, even before it listens.
- **Drain (seconds):** how long a replica that is being replaced keeps answering while traffic moves away, before it is told to stop. The default is 5, the range 0–300, and 0 stops it at once. Only apps with ports drain. The app then has 30 seconds to exit.

Rollouts start the new replica first and stop an old one only after that. Set a health check for every app that serves traffic.

<div class="note">The drain setting is in v0.5.0-rc.3 and later, including v0.6.0-rc.1. In v0.4.0 and earlier release candidates this card is called <b>Health check</b> and has no drain field.</div>

## Revisions, rollback and restart

Every **Save & deploy** creates a new revision and rolls it out one replica at a time. The **Overview** tab lists the recent revisions (up to 20) with their image or commit.

- **Roll back** on an older revision runs that revision's image again, as a new revision. Environment, replicas and ports stay as they are now. For Git apps, the app stays pinned to that image until you click **Follow builds again**.
- **Restart** replaces the replicas one at a time with the same image. It creates no revision.
- **Delete** stops every replica and removes the app's service, routes and network policy. Type the app's name to confirm. Its shared volumes are kept.

If someone else saved the settings while you were editing, Kwerft refuses your save and offers **Load the latest**.

## Logs

The **Logs** tab has two sources:

- **Live replicas** streams from the running pods. Pick one replica or all, a time range (15 m, 1 h, 24 h), **Previous container** for the instance before the last restart, **Follow**, **Timestamps** and **Download**.
- **History** searches every replica's lines in VictoriaLogs, including pods that are gone, for 14 days (3 days on servers installed with `--lite`).

The live stream is capped at 200 lines per second; beyond that, lines are skipped and the viewer says so. Search across apps under [Monitoring › Logs](/docs/monitoring#log-search).

The **Metrics** tab shows CPU, memory against the limit, restarts, and, for apps with a public hostname, requests per second, 5xx errors and the 95th-percentile response time.

## Shell

On the **Overview** tab, the replicas table has **Logs** and **Shell** for each pod. A shell needs the developer role or higher.

- **Shell** picks **bash, else sh**, or a specific one. For images without a shell (distroless, `FROM scratch`), choose **debug toolbox**: a busybox container next to the app that sees its processes and network.
- A shell closes after 15 minutes without input and ends after an hour. Each person can have three open at once.
- Every session is **Recorded**: what the terminal shows, not your keystrokes. Owners and admins can replay it under [Access › Recordings](/docs/access#shell-recordings).

## Run the app's image as a job

**Run as job** starts a one-off task with the app's image, command, environment, size and volumes, with optional environment overrides such as `DRY_RUN=1`. See [Jobs](/docs/jobs).
