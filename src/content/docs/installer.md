---
title: Installer reference
description: Every flag of install.sh, the --config file, environment variables, remembered settings, the install stages, re-running to repair or upgrade, version pinning, restoring from a backup, exit codes, the firewall rescue and uninstalling.
group: Reference
order: 1
---

`install.sh` is a single bash script that turns a fresh Ubuntu server into a Kwerft cluster. It also joins servers to a cluster, installs remote clusters in agent mode, restores a console from a backup, rescues a locked firewall and uninstalls. Every stage is idempotent: running the same command again repairs or upgrades the install. For a first install, start with [Getting started](/getting-started).

## Run it

The script runs as root. `kwerft.dev/install.sh` forwards to the script in the public [ehilzinger/kwerft-install](https://github.com/ehilzinger/kwerft-install) repository on GitHub:

```bash
curl -fsSL https://kwerft.dev/install.sh | sudo bash -s -- --domain ops.example.com --email ops@example.com --yes
```

Or download it first, read it, and run it:

```bash
curl -fsSLO https://kwerft.dev/install.sh
sudo bash install.sh --help
```

The whole script is a set of functions called on its last line, so a download that breaks off halfway never runs half a script.

## Pin a version

`https://kwerft.dev/install.sh` is always the latest stable release (v0.4.0 at the time of writing). Every release, release candidates included, also has its own copy at `https://kwerft.dev/<version>/install.sh`:

```bash
curl -fsSL https://kwerft.dev/v0.4.0/install.sh | sudo bash -s -- --domain ops.example.com --yes
```

A pinned script installs its own version. To try what is in release candidates, pin the newest one, v0.6.0-rc.9:

```bash
curl -fsSL https://kwerft.dev/v0.6.0-rc.9/install.sh | sudo bash -s -- --domain ops.example.com --yes
```

v0.6.0-rc.9 contains everything from the v0.5.0 release candidates ([Clusters & nodes](/docs/clusters-and-nodes), the Hetzner Cloud integration and several of the flags below) and adds [backups](/docs/backups), [upgrades from the console](/docs/upgrades), [secret sets](/docs/secrets), [templates and the Compose import](/docs/templates-and-compose), the [infrastructure map](/docs/overview) and [disk health](/docs/clusters-and-nodes#disk-health) for dedicated servers. Release candidates are for trying things out; expect changes before the release.

`--version` picks the Kwerft release (console image and Helm chart) independently of the script; it takes `0.4.0` or `v0.4.0`. The installer checks that the release is published before it changes anything and stops with exit code 50 if it is not. Prefer the script of the release you install, since flags and stages change between releases.

The console image is `ghcr.io/ehilzinger/kwerft` (amd64 and arm64) and the chart `oci://ghcr.io/ehilzinger/charts/kwerft`; both are public, so no registry login is needed.

## Options

Flags marked **v0.5.0** exist from the v0.5.0 release candidates on, flags marked **v0.6.0** from v0.6.0-rc.1 on.

### Install

| Flag | What it does |
|---|---|
| `--domain HOST` | The console's hostname. Without it, a temporary `<public-ip>.sslip.io` name is used. A hostname given here replaces the one chosen in Settings; without it, a re-run keeps the current one. |
| `--email ADDR` | Let's Encrypt account contact (optional). |
| `--acme-server URL` | **v0.5.0.** The ACME directory for certificates, or `staging` for Let's Encrypt's staging CA (untrusted certificates, generous rate limits, for tests). Default: Let's Encrypt production. Remembered from v0.6.0 on; with earlier releases, give it on every run. |
| `--config FILE` | Read settings from a YAML file; see [Config file](#config-file). |
| `--platform P` | `auto` (default), `cloud` or `dedicated`. `auto` asks the Hetzner Cloud metadata service. |
| `--private-iface IF` | The interface for node-to-node and Kubernetes API traffic. By default, the first interface with a private (RFC 1918) address that is not the default route. |
| `--version V` | The Kwerft release to install. Default: the script's own release. |
| `--channel C` | `stable` (default) or `edge`. Only shown in the installer's banner and remembered; choose releases with `--version`. The console's update channel is set under [Settings › Updates](/docs/upgrades#update-policy). |
| `--lite` | Smaller footprint for 4 GB servers: no Hubble, no Velero (so no [backups](/docs/backups)), metrics kept 7 days and logs 3 days instead of 30 and 14. |
| `--harden-ssh` | Turn off SSH password logins and root password logins. Check that your SSH key works first. |
| `--k3s-version V` | **v0.6.0.** The k3s release a new server installs instead of the pinned one, such as `v1.37.1+k3s1`; also with `--join` and `--agent`. A running cluster keeps its version: upgrade it under [Settings › Updates](/docs/upgrades#upgrade-kubernetes). Node pools pass the cluster's running version. |

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

### Restore onto a new server

**v0.6.0.** See [Restore from a backup](#restore-from-a-backup) and [Backups](/docs/backups#restore-the-whole-console-onto-a-new-server).

| Flag | What it does |
|---|---|
| `--restore B` | Restore the console and every project from a backup: `latest` (the newest complete Cluster backup) or a backup's name. Needs `--config` with a `backups:` block. The console's hostname comes from the backup unless `--domain` is given. |

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
| `--progress FILE` | **v0.6.0.** Write one JSON line per stage to `FILE` (`{"id", "label", "state", "detail", "at"}`, with `state` `ok`, `skip` or `fail`), then `{"exit": <code>}`. The console's upgrades read it. The file's directory must exist. |
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
| `KWERFT_LITE`, `KWERFT_HARDEN_SSH` | `--lite`, `--harden-ssh` (v0.6.0; `1`, `true` or `yes`; `KWERFT_LITE=0` turns a remembered `--lite` off) |
| `KWERFT_K3S_VERSION` | `--k3s-version` (v0.6.0) |
| `KWERFT_PROGRESS` | `--progress` (v0.6.0) |
| `KWERFT_RESTORE` | `--restore` (v0.6.0) |

Switches such as `--yes`, `--dry-run` or `--agent` have no environment variable; pass them as flags. Before v0.6.0, `--lite` and `--harden-ssh` had none either.

```bash
curl -fsSL https://kwerft.dev/install.sh \
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
| `backups.endpoint` | **v0.6.0**, for `--restore` only. The S3 endpoint, such as `https://fsn1.your-objectstorage.com`. |
| `backups.region` | Optional. Taken from a Hetzner endpoint (`fsn1`), else `us-east-1`. |
| `backups.bucket` | The bucket the backups are in. |
| `backups.prefix` | The folder in the bucket, as Settings › Backups showed it. Defaults to `--domain`; without either it is required. |
| `backups.accessKeyFile`, `backups.secretKeyFile` | Files with the S3 access key and secret key. |
| `backups.recoveryKeyFile` | A file with the recovery key. The file the console offers for download works as it is. |

An apps domain or DNS solver given here replaces what was chosen in Settings; without them, Settings stays as it is. The token files stay where they are; the cluster keeps a copy that the console never shows. See [Domains & TLS](/docs/domains-and-tls) and [Clusters & nodes](/docs/clusters-and-nodes).

<div class="warn"><b>Known issue: the owner account.</b> The installer's help says <code>--config</code> pre-seeds the owner and skips the setup wizard, with an <code>owner: { email, passwordFile }</code> section. In current releases the console does not apply that section, and an install with <code>--config</code> creates no setup token, so it has no way to create the owner. Until this is fixed, run the installer once more <b>without</b> <code>--config</code>: it keeps the settings already applied, creates a setup token and prints the <code>/setup</code> address.</div>

## Stages

The installer runs these stages in order and prints one line per stage. Completed stages are recorded in `/var/lib/kwerft/stages/`. The column on the right is v0.6.0's behaviour; before it, System and Helm also ran only once.

| Stage | What it does | On a re-run |
|---|---|---|
| Preflight | Root, Ubuntu version, architecture, RAM, disk, cgroup v2, ports 80/443, outbound HTTPS, public IPv4, release published | Always runs |
| System | Packages, kernel modules, sysctls, swap off, chrony, unattended-upgrades, optional SSH hardening | Always runs |
| Firewall | Kwerft's nftables table: 22, 80, 443 public, cluster traffic only from the private network and pods | Always runs |
| Kubernetes | k3s server with embedded etcd and secrets encryption; from v0.6.0 also local etcd snapshots every 6 hours | Skipped: shows the running k3s version |
| Registry mirror | Lets every node pull images built from Git from the in-cluster registry | Always runs |
| Helm | Installs Helm | Always runs |
| Upgrades | **v0.6.0.** The system-upgrade-controller, which [Kubernetes upgrades](/docs/upgrades#upgrade-kubernetes) use, and the label `kwerft.dev/installer=true` on this server's node | Always runs |
| Network | Cilium with WireGuard and (unless `--lite`) Hubble | Always runs |
| Hetzner Cloud | **v0.5.0.** On Cloud servers with a token: CSI driver (Cloud Volumes), optionally the cloud-controller-manager | Always runs |
| Ingress & TLS | Gateway API, cert-manager with the Hetzner DNS webhook, Traefik on ports 80/443 | Always runs |
| Observability | VictoriaMetrics, VictoriaLogs and Vector | Always runs |
| Backups | **v0.6.0.** Velero for [backups](/docs/backups) (not with `--lite`), and the etcd snapshot settings | Always runs |
| Restore | **v0.6.0.** Only with `--restore`: restores the backup | Skipped once done |
| Kwerft | Kwerft's resources and Helm chart (in agent mode: **Kwerft agent**) | Always runs |
| Handoff | Checks DNS, creates the setup token if needed, prints the summary | Always runs |

In agent mode, Backups, Restore and Handoff do not run. In join mode the stages are Preflight, System, Firewall, **Join cluster** and Registry mirror.

`--dry-run` lists the stages it would run without running any.

The installer's own log is `/var/log/kwerft/install.log`. When a stage fails, the installer names it, its exit code and the log, and tells you to re-run the same command.

## Re-run to repair or upgrade

Run the same command again at any time. Re-running converges everything but Kubernetes:

- **Repair:** stages that always run converge the server back to the expected state; completed one-time stages are skipped.
- **Upgrade:** the script of a newer release upgrades Kwerft and the components pinned in it (Cilium, cert-manager, Traefik, monitoring, and from v0.6.0 Velero, the system-upgrade-controller, system packages and Helm). k3s keeps the version it was installed with, on every node; from v0.6.0 it is upgraded from the console. From v0.6.0 on, the console also upgrades Kwerft itself, with automatic rollback: see [Upgrades](/docs/upgrades).
- **Settings are kept:** without `--domain`, the console's hostname stays what Settings chose. Other settings are remembered from v0.6.0 on (next section); before v0.6.0, `--acme-server` must be given on every run, or certificates come from Let's Encrypt production again.
- **The firewall stays up:** reloading the firewall replaces Kwerft's base rules in one step and keeps the console's rules, so there is no moment without a firewall.

### Remembered settings

**v0.6.0.** Every run writes its settings to `/var/lib/kwerft/install.env` (root only), and later runs reuse them, so a re-run needs no flags: `--email`, `--acme-server`, `--platform`, `--private-iface`, `--lite`, `--harden-ssh`, `--channel`, the mode (install, agent or join) and, in agent mode, `--console`. Flags and `KWERFT_*` environment variables win over the file.

Not remembered: the console's hostname (Settings is the record), tokens, `--config`, `--version` and `--k3s-version`. An agent cluster reads its agent token back from the cluster; a joined server re-runs without `--join` and `--token`.

A server installed before v0.6.0 has no such file yet. On its first run of a v0.6.0 installer, give the flags you installed with (for example `--acme-server staging` or `--lite`); after that they are remembered.

### The setup token

The handoff stage creates a single-use setup token in `/etc/kwerft/setup-token` (readable by root only), valid for 24 hours; only its hash goes into the cluster. If the file is lost or the token expired before anyone used it, a re-run creates a new one. Once the owner account exists, a re-run removes any leftover token and prints the console's address instead.

## Restore from a backup

**v0.6.0.** On a fresh server, `--restore` rebuilds a console from a Cluster backup in Object Storage: projects, apps with their volume data, members, settings and history.

```bash
curl -fsSL https://kwerft.dev/v0.6.0-rc.9/install.sh | sudo bash -s -- --config /root/kwerft.yaml --restore latest --yes
```

The config file needs a `backups:` block (see [Config file](#config-file)):

```yaml
backups:
  endpoint: https://fsn1.your-objectstorage.com
  bucket: acme-kwerft
  prefix: ops.example.com
  accessKeyFile: /root/s3.access
  secretKeyFile: /root/s3.secret
  recoveryKeyFile: /root/kwerft-recovery-key.txt
```

The installer runs the usual stages, then **Restore** before the Kwerft stage. It waits up to 10 minutes for Velero to read the bucket and up to 4 hours for the restore itself. The console keeps the hostname from the backup unless `--domain` says otherwise; everyone signs in with their existing accounts, and no setup token is created.

`--restore` is refused (exit code 2) on a server that already runs Kwerft, with `--lite`, and with `--agent`, `--join`, `--uninstall` or `--reset-firewall`. If the restore fails, the installer stops with exit code 60; run the same command again to continue. The full procedure and its limits are on [Backups](/docs/backups#restore-the-whole-console-onto-a-new-server).

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
| 60 | Restore (v0.6.0): the backup could not be read or restored; see [Troubleshooting](/docs/troubleshooting#a-restore-fails-with-exit-code-60) |

## Firewall rescue

If a firewall change locked you out of SSH, open the server's console from Hetzner (VNC for Cloud servers, KVM for dedicated ones) and run:

```bash
curl -fsSL https://kwerft.dev/install.sh | sudo bash -s -- --reset-firewall
```

It removes Kwerft's nftables table and pauses the console's firewall rules on this node, so they are not put back. Run your install command again to restore the baseline, and delete `/var/lib/kwerft/firewall/paused` to let the console manage this node's firewall again. See [Network › Server firewall](/docs/network#server-firewall).

## Uninstall

```bash
curl -fsSL https://kwerft.dev/install.sh | sudo bash -s -- --uninstall --yes
```

This removes k3s with every workload on the server and the data on its local volumes, Kwerft's firewall table, the registry mirror and AppArmor profile, `/var/lib/kwerft`, `/etc/kwerft` and Kwerft's sysctl, module and SSH files. The logs in `/var/log/kwerft` stay. Without `--yes` it asks first.

A Hetzner Cloud Firewall or Load Balancer that Kwerft created stays in your Hetzner project. Turn them off in Settings before you uninstall, or delete them in the Hetzner Console afterwards.

Uninstalling deletes your apps' data. From v0.6.0, Kwerft can [back it up](/docs/backups) to Object Storage first; a backup in the bucket is not touched by an uninstall.

## Pinned components

Each release pins the versions it installs at the top of the script. The v0.6.0 release candidates pin the following; v0.4.0 and the v0.5.0 release candidates pin the same versions of the components they have.

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
| system-upgrade-controller (v0.6.0) | v0.20.2 |
| Velero (v0.6.0) | v1.18.4 |
| Velero chart (v0.6.0) | 12.2.0 |
| velero-plugin-for-aws (v0.6.0) | v1.14.4 |
