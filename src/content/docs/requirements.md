---
title: Requirements
description: The server, operating system, memory, disk, network and DNS Kwerft needs, and what the installer changes on the host.
group: Start
order: 1
---

Kwerft installs onto one fresh Ubuntu server and grows from there. This page lists what that server needs before you run the installer, and what the installer changes on it. For the install itself, see [Getting started](/getting-started).

## The server

| | Requirement |
|---|---|
| Provider | A Hetzner Cloud server or a Hetzner dedicated (Robot) server |
| Operating system | Ubuntu 22.04, 24.04 or 26.04 LTS |
| CPU architecture | amd64 (x86_64) or arm64 (aarch64) |
| Memory | 8 GB recommended; 4 GB works with `--lite` |
| Disk | At least 30 GB free on `/` |
| Access | Root, or a user who can run `sudo` |

The installer tells Hetzner Cloud from dedicated servers by asking the Cloud metadata service. If that guess is wrong, pass `--platform cloud` or `--platform dedicated`.

Use a fresh server. The installer stops if something already listens on port 80 or 443 (for example nginx or Apache), and it expects to own Kubernetes on that machine.

### Memory

The platform itself (k3s, Cilium, Traefik, cert-manager, VictoriaMetrics, VictoriaLogs and Kwerft) uses about 2.5 GB of RAM on an idle server. Each running Git build needs another 1–2 GB. That is why 8 GB is the recommended size.

From v0.6.0, the installer also adds Velero for [backups](/docs/backups): its server and its node agent (one per node) each reserve 128 MiB, and use more while a backup copies volume data (up to 512 MiB and 1 GiB). The system-upgrade-controller for Kubernetes upgrades is small.

The installer refuses servers with less than 4 GB and warns below 8 GB. On a 4 GB server, install with `--lite`:

- Hubble is off, so [traffic rules](/docs/network) show no allowed and dropped counts.
- Velero is left out, so there are no [backups](/docs/backups) (v0.6.0).
- Metrics are kept 7 days instead of 30, logs 3 days instead of 14.

That leaves room for a few small apps, not for much else.

### Other checks

Before it changes anything, the installer's preflight stage also checks that:

- the kernel runs cgroup v2 (the Ubuntu default),
- the server has a public IPv4 address,
- outbound HTTPS works (it downloads k3s, Helm charts and container images),
- the Kwerft release you asked for is published.

A failed check ends the run with exit code 10 (preflight) or 20 (network). See [exit codes](/docs/installer#exit-codes).

[Upgrades from the console](/docs/upgrades) (v0.6.0) also need at least 5 GiB free under `/var/lib` on the server the installer ran on.

## Network and ports

After the install, the host firewall lets these in from anywhere:

| Port | What for |
|---|---|
| TCP 22 | SSH |
| TCP 80 | HTTP: Let's Encrypt HTTP-01 challenges and the redirect to HTTPS |
| TCP 443 | HTTPS: the console and your apps |
| UDP 51871 | WireGuard between nodes (Cilium) |

Everything else, including the Kubernetes API on 6443, is only reachable from the server's private network and from pods. You can narrow SSH and open more ports later under [Network › Server firewall](/docs/network#server-firewall).

Outbound, the server needs HTTPS to download k3s, charts and images. From v0.6.0 it also reaches your backup bucket's endpoint, and, unless the update policy is **Off**, `raw.githubusercontent.com` to look for new releases.

If you use a Hetzner Cloud Firewall of your own in front of the server, it must let TCP 80 and 443 in, or certificates cannot be issued and nobody reaches the console.

### Private network

A single server needs no private network. To add more servers to the same cluster later, they need one they share:

- **Hetzner Cloud:** attach the servers to the same Cloud Network.
- **Dedicated servers:** a vSwitch coupled to the Cloud Network.

The installer picks the first private (RFC 1918) address that is not on the default route as the node address. Pass `--private-iface` to choose the interface yourself. See [Clusters & nodes](/docs/clusters-and-nodes).

## DNS

DNS is optional for a first try. Without `--domain`, the console gets a temporary hostname `<public-ip>.sslip.io`, which the public sslip.io service resolves to your server. It works for trying Kwerft, not for production.

For your own hostname, create an A record pointing at the server's public IPv4 address before or after the install, for example `ops.example.com`. Let's Encrypt issues the console's certificate once the record resolves to the server.

For apps, you have three options:

- A record per app hostname, pointing at the server.
- One wildcard record, such as `*.apps.example.com`, that covers every app under an apps domain.
- Let Kwerft keep the records in Hetzner DNS for you (zones in the Hetzner Console, with an API token).

[Domains & TLS](/docs/domains-and-tls) explains the apps domain, wildcard certificates and managed records.

## What the installer changes on the host

The installer keeps its changes in files it owns, so you can see exactly what it did:

| Change | Where |
|---|---|
| Packages: curl, ca-certificates, jq, nftables, chrony, unattended-upgrades, open-iscsi | apt |
| Swap turned off; swap lines commented out (`# disabled by kwerft`) | `/etc/fstab` |
| Kernel modules overlay, br_netfilter, wireguard | `/etc/modules-load.d/kwerft.conf` |
| IP forwarding, inotify and `vm.max_map_count` sysctls | `/etc/sysctl.d/90-kwerft.conf` |
| chrony and unattended-upgrades enabled | systemd |
| Host firewall: its own nftables table `inet kwerft` | `/etc/nftables.d/kwerft.nft`, plus an include line in `/etc/nftables.conf` |
| k3s (embedded etcd, secrets encryption, no flannel, no kube-proxy) | `/etc/rancher/k3s/config.yaml` |
| Registry mirror for images built from Git | `/etc/rancher/k3s/registries.yaml` |
| AppArmor profile for rootless builds | `/etc/apparmor.d/kwerft-buildkit` |
| Helm | `/usr/local/bin/helm` |
| Local etcd snapshots every 6 hours, 28 kept (v0.6.0) | `/etc/rancher/k3s/config.yaml.d/50-kwerft-etcd-snapshots.yaml` |
| State, remembered settings (`install.env`, v0.6.0), setup token, install log | `/var/lib/kwerft`, `/etc/kwerft`, `/var/log/kwerft` |

With `--harden-ssh` it also writes `/etc/ssh/sshd_config.d/90-kwerft.conf`, which turns off password logins and root password logins. Make sure your SSH key works before you use it.

The installer never edits the nftables rules or `registries.yaml` entries you wrote yourself. If `registries.yaml` exists and was not written by Kwerft, it leaves the file alone and prints the lines to add.

`install.sh --uninstall` removes k3s, the firewall table and these files again, keeping the logs. See the [installer reference](/docs/installer#uninstall).
