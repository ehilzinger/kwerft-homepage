---
title: Installer reference
description: Every flag of install.sh, the --config file, environment variables, the install stages, re-running to repair or upgrade, version pinning, exit codes, the firewall rescue and uninstalling.
group: Reference
order: 1
---

`install.sh` is a single bash script that turns a fresh Ubuntu server into a Kwerft cluster. It also joins servers to a cluster, installs remote clusters in agent mode, rescues a locked firewall and uninstalls. Every stage is idempotent: running the same command again repairs or upgrades the install. For a first install, start with [Getting started](/getting-started).

## Run it

The script runs as root. Pipe it from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh | sudo bash -s -- --domain ops.example.com --email ops@example.com --yes
```

Or download it first, read it, and run it:

```bash
curl -fsSLO https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh
sudo bash install.sh --help
```

The whole script is a set of functions called on its last line, so a download that breaks off halfway never runs half a script.

## Pin a version

`…/kwerft-install/main/install.sh` is always the latest stable release (v0.4.0 at the time of writing). Every release, release candidates included, also has its own copy:

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/v0.4.0/install.sh | sudo bash -s -- --domain ops.example.com --yes
```

A pinned script installs its own version. The release candidates of v0.5.0, which bring [Clusters & nodes](/docs/clusters-and-nodes), the Hetzner Cloud integration and several of the flags below, are at `…/main/v0.5.0-rc.2/install.sh`.

`--version` picks the Kwerft release (console image and Helm chart) independently of the script; it takes `0.4.0` or `v0.4.0`. The installer checks that the release is published before it changes anything and stops with exit code 50 if it is not. Prefer the script of the release you install, since flags and stages change between releases.

The console image is `ghcr.io/ehilzinger/kwerft` (amd64 and arm64) and the chart `oci://ghcr.io/ehilzinger/charts/kwerft`; both are public, so no registry login is needed.

## Options

Flags marked **v0.5.0** exist from the v0.5.0 release candidates on.

### Install

| Flag | What it does |
|---|---|
| `--domain HOST` | The console's hostname. Without it, a temporary `<public-ip>.sslip.io` name is used. A hostname given here replaces the one chosen in Settings; without it, a re-run keeps the current one. |
| `--email ADDR` | Let's Encrypt account contact (optional). |
| `--acme-server URL` | **v0.5.0.** The ACME directory for certificates, or `staging` for Let's Encrypt's staging CA (untrusted certificates, generous rate limits, for tests). Default: Let's Encrypt production. Give it on every run. |
| `--config FILE` | Read settings from a YAML file; see [Config file](#config-file). |
| `--platform P` | `auto` (default), `cloud` or `dedicated`. `auto` asks the Hetzner Cloud metadata service. |
| `--private-iface IF` | The interface for node-to-node and Kubernetes API traffic. By default, the first interface with a private (RFC 1918) address that is not the default route. |
| `--version V` | The Kwerft release to install. Default: the script's own release. |
| `--channel C` | `stable` (default) or `edge`. Currently only shown in the installer's banner; choose releases with `--version`. |
| `--lite` | Smaller footprint for 4 GB servers: no Hubble, metrics kept 7 days and logs 3 days instead of 30 and 14. |
| `--harden-ssh` | Turn off SSH password logins and root password logins. Check that your SSH key works first. |

### Join an existing cluster

You rarely type these yourself: the console's join command (Clusters & nodes › a cluster › Nodes › **Join a server**) and node pools pass them.

| Flag | What it does |
|---|---|
| `--join URL --token T` | Join the cluster whose console runs at `URL`, with a join token from that console. |
| `--role R` | `worker` (default) or `control-plane`. |
| `--node-label K=V` | **v0.5.0.** Label this node; repeatable. Node pools set `kwerft.dev/pool`. |
| `--node-taint K=V:E` | **v0.5.0.** Taint this node; repeatable. Build pools set `kwerft.dev/builds=true:NoSchedule`. |

### Connect a new cluster to a console (agent mode)

**v0.5.0.** Installs Kwerft without its own console; the cluster is managed from another console. The console's **Adopt a cluster** dialog shows the whole command. See [Clusters & nodes](/docs/clusters-and-nodes#adopt-an-existing-server).

| Flag | What it does |
|---|---|
| `--agent` | Agent mode. Cannot be combined with `--domain`, `--config` or `--join`. |
| `--console URL` | The console, as `https://<hostname>`. |
| `--cluster-token T` | This cluster's agent token from the console (`kwag_…`). |
| `--await-cloud-token` | Wait up to 5 minutes for the console to hand over its Hetzner Cloud token, then add Cloud Volumes. Servers Kwerft creates use this. |

A server keeps the mode it was installed in: `--agent` on a console server, or a plain install on an agent server, stops with exit code 2.

### Development

| Flag | What it does |
|---|---|
| `--image REF` | Run this console image (`repository:tag`) instead of the release's. |
| `--image-archive FILE` | Import a docker/OCI tarball into k3s first; needs `--image`. |

### Maintenance

| Flag | What it does |
|---|---|
| `--reset-firewall` | Remove Kwerft's host firewall and pause the console's firewall rules on this server; see [Firewall rescue](#firewall-rescue). |
| `--uninstall` | Remove Kwerft and k3s from this server; see [Uninstall](#uninstall). |

### General

| Flag | What it does |
|---|---|
| `--dry-run` | Print the plan without changing anything. |
| `--yes`, `-y` | Never prompt. Needed when nothing can answer a prompt, such as `--uninstall` from a script. |
| `--help`, `-h` | Show the help. |

## Environment variables

Options with a value can also come from the environment; flags win. This suits cloud-init and CI:

| Variable | Same as |
|---|---|
| `KWERFT_DOMAIN` | `--domain` |
| `KWERFT_EMAIL` | `--email` |
| `KWERFT_ACME_SERVER` | `--acme-server` |
| `KWERFT_CONFIG` | `--config` |
| `KWERFT_PLATFORM` | `--platform` |
| `KWERFT_PRIVATE_IFACE` | `--private-iface` |
| `KWERFT_VERSION` | `--version` |
| `KWERFT_CHANNEL` | `--channel` |
| `KWERFT_JOIN_URL`, `KWERFT_JOIN_TOKEN`, `KWERFT_JOIN_ROLE` | `--join`, `--token`, `--role` |
| `KWERFT_CONSOLE`, `KWERFT_CLUSTER_TOKEN` | `--console`, `--cluster-token` |
| `KWERFT_IMAGE`, `KWERFT_IMAGE_ARCHIVE` | `--image`, `--image-archive` |

Switches such as `--lite`, `--yes` or `--agent` have no environment variable; pass them as flags.

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh \
  | sudo KWERFT_DOMAIN=ops.example.com bash -s -- --yes
```

## Config file

`--config FILE` reads a YAML file for unattended installs. Flags still win over it. Nested keys can be written as a block or inline (`dns: { solver: hetzner, tokenFile: /root/dns.token }`).

```yaml
domain: ops.example.com
email: ops@example.com
appsDomain: apps.example.com
dns:
  solver: hetzner
  tokenFile: /root/dns.token
  records: true
hcloud:
  tokenFile: /root/hcloud.token
```

| Key | Meaning |
|---|---|
| `domain` | The console's hostname, like `--domain`. |
| `email` | Let's Encrypt contact, like `--email`. |
| `appsDomain` | Base domain for apps: they get `<name>.<appsDomain>`. |
| `dns.solver` | `hetzner`: a wildcard certificate for `*.<appsDomain>` through Hetzner DNS (DNS-01). Needs `appsDomain` and `dns.tokenFile`. |
| `dns.tokenFile` | A file with a Hetzner API token (Read & Write) for the DNS zone. |
| `dns.records` | `true` (default) or `false`: whether Kwerft keeps the A/AAAA records of the console's hostname and `*.<appsDomain>`. Applies with `dns.solver`. |
| `hcloud.tokenFile` | **v0.5.0.** A file with a Hetzner Cloud API token (Read & Write), stored as Settings › Hetzner Cloud API's token. On Cloud servers it also adds Cloud Volumes. |
| `hcloud.cloudControllerManager` | **v0.5.0.** `true` installs the Hetzner cloud-controller-manager. Cloud servers only, needs `hcloud.tokenFile`, and only takes effect on a cluster's first install. |
| `hcloud.loadBalancer` | **v0.5.0.** `true` or `false`: a Hetzner Load Balancer in front of the ingress. When set, it replaces the choice in Settings on every run. |

An apps domain or DNS solver given here replaces what was chosen in Settings; without them, Settings stays as it is. The token files stay where they are; the cluster keeps a copy that the console never shows. See [Domains & TLS](/docs/domains-and-tls) and [Clusters & nodes](/docs/clusters-and-nodes).

<div class="warn"><b>Known issue: the owner account.</b> The installer's help says <code>--config</code> pre-seeds the owner and skips the setup wizard, with an <code>owner: { email, passwordFile }</code> section. In current releases the console does not apply that section, and an install with <code>--config</code> creates no setup token, so it has no way to create the owner. Until this is fixed, run the installer once more <b>without</b> <code>--config</code>: it keeps the settings already applied, creates a setup token and prints the <code>/setup</code> address.</div>

## Stages

The installer runs these stages in order and prints one line per stage. Completed stages are recorded in `/var/lib/kwerft/stages/`.

| Stage | What it does | On a re-run |
|---|---|---|
| Preflight | Root, Ubuntu version, architecture, RAM, disk, cgroup v2, ports 80/443, outbound HTTPS, public IPv4, release published | Always runs |
| System | Packages, kernel modules, sysctls, swap off, chrony, unattended-upgrades, optional SSH hardening | Skipped |
| Firewall | Kwerft's nftables table: 22, 80, 443 public, cluster traffic only from the private network and pods | Always runs |
| Kubernetes | k3s server with embedded etcd and secrets encryption | Skipped |
| Registry mirror | Lets every node pull images built from Git from the in-cluster registry | Always runs |
| Helm | Installs Helm | Skipped |
| Network | Cilium with WireGuard and (unless `--lite`) Hubble | Always runs |
| Hetzner Cloud | **v0.5.0.** On Cloud servers with a token: CSI driver (Cloud Volumes), optionally the cloud-controller-manager | Always runs |
| Ingress & TLS | Gateway API, cert-manager with the Hetzner DNS webhook, Traefik on ports 80/443 | Always runs |
| Observability | VictoriaMetrics, VictoriaLogs and Vector | Always runs |
| Kwerft | Kwerft's resources and Helm chart (in agent mode: **Kwerft agent**) | Always runs |
| Handoff | Checks DNS, creates the setup token if needed, prints the summary | Always runs |

In join mode the stages are Preflight, System, Firewall, **Join cluster** and Registry mirror.

`--dry-run` lists the stages it would run without running any.

The installer's own log is `/var/log/kwerft/install.log`. When a stage fails, the installer names it, its exit code and the log, and tells you to re-run the same command.

## Re-run to repair or upgrade

Run the same command again at any time:

- **Repair:** stages that always run converge the server back to the expected state; completed one-time stages are skipped.
- **Upgrade:** the script of a newer release upgrades Kwerft and the components pinned in it (Cilium, cert-manager, Traefik, monitoring). k3s is installed once and not upgraded by a re-run. Upgrades with automatic rollback are planned before the public beta.
- **Settings are kept:** without `--domain`, the console's hostname stays what Settings chose. `--acme-server` must be given on every run, or certificates come from Let's Encrypt production again.
- **The firewall stays up:** reloading the firewall replaces Kwerft's base rules in one step and keeps the console's rules, so there is no moment without a firewall.

### The setup token

The handoff stage creates a single-use setup token in `/etc/kwerft/setup-token` (readable by root only), valid for 24 hours; only its hash goes into the cluster. If the file is lost or the token expired before anyone used it, a re-run creates a new one. Once the owner account exists, a re-run removes any leftover token and prints the console's address instead.

## Exit codes

Exit codes are a stable contract for automation:

| Code | Meaning |
|---|---|
| 0 | OK |
| 2 | Usage: an unknown or invalid option, or an aborted prompt |
| 10 | Preflight: the server does not meet the [requirements](/docs/requirements) |
| 20 | Network or DNS: no outbound HTTPS, no public IPv4, a join URL or registry unreachable |
| 30 | Kubernetes: k3s did not install or become ready |
| 40 | Platform: Cilium, cert-manager, Traefik, monitoring or a Hetzner component failed |
| 50 | Kwerft: the release is not published, or the Kwerft chart failed |

## Firewall rescue

If a firewall change locked you out of SSH, open the server's console from Hetzner (VNC for Cloud servers, KVM for dedicated ones) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh | sudo bash -s -- --reset-firewall
```

It removes Kwerft's nftables table and pauses the console's firewall rules on this node, so they are not put back. Run your install command again to restore the baseline, and delete `/var/lib/kwerft/firewall/paused` to let the console manage this node's firewall again. See [Network › Server firewall](/docs/network#server-firewall).

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh | sudo bash -s -- --uninstall --yes
```

This removes k3s with every workload on the server and the data on its local volumes, Kwerft's firewall table, the registry mirror and AppArmor profile, `/var/lib/kwerft`, `/etc/kwerft` and Kwerft's sysctl, module and SSH files. The logs in `/var/log/kwerft` stay. Without `--yes` it asks first.

A Hetzner Cloud Firewall or Load Balancer that Kwerft created stays in your Hetzner project. Turn them off in Settings before you uninstall, or delete them in the Hetzner Console afterwards.

There are no backups yet (they are planned before the public beta): uninstalling deletes your apps' data.

## Pinned components

Each release pins the versions it installs at the top of the script. v0.4.0 and v0.5.0-rc.2 pin:

| Component | Version |
|---|---|
| k3s | v1.37.1+k3s1 |
| Helm | v4.3.0 |
| Cilium | 1.20.2 |
| cert-manager | v1.21.2 |
| Gateway API (only if k3s does not ship it) | v1.6.2 |
| Traefik chart | 41.6.1 |
| victoria-metrics-k8s-stack chart | 0.95.0 |
| victoria-logs-single chart | 0.13.10 |
| cert-manager-webhook-hetzner chart | 0.9.0 |
| zot registry | v2.1.21 |
| BuildKit (rootless) | v0.33.1 |
| Railpack | v0.40.1 |
| hcloud CSI chart (v0.5.0) | 2.23.0 |
| hcloud cloud-controller-manager chart (v0.5.0) | 1.38.0 |
