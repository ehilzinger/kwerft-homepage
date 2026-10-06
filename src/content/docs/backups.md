---
title: Backups
description: Back up projects, volumes and the console to S3-compatible storage, encrypted with a recovery key, restore a project or some apps, rebuild the whole console on a new server with --restore, and etcd snapshots.
group: Operate
order: 5
---

Kwerft backs up your projects, their volumes and its own state to an S3 bucket, such as Hetzner Object Storage, with [Velero](https://velero.io). Everything in the bucket is encrypted with a **recovery key** that Kwerft shows you once; keep a copy outside the cluster, because a restore onto a new server needs it. From the console you restore a project or some of its apps; with `install.sh --restore` you rebuild the whole console on a new server.

<div class="note">Backups need Kwerft v0.6.0, which is in release candidates. The default install command installs v0.4.0; to try them, <a href="/docs/installer#pin-a-version">pin v0.6.0-rc.3</a>. They have been tested against simulated S3 storage only, not yet against real Hetzner Object Storage, and the end-to-end restore onto a new server has not run on real servers yet. Keep a second copy of data you cannot lose until backups have proven themselves for you.</div>

Owners and admins set up backups and restore. The **Backups** page and the backup settings are hidden from other roles.

## What a backup holds

A backup of everything (a **Cluster** backup) holds:

- every project: apps, jobs, volumes with their data, secret sets, domains and traffic rules,
- Kwerft's own state: the console's database (members, sign-in settings, API tokens, the audit log), the data key, the stored tokens and the TLS certificates, so a restore needs no new certificates,
- images built from Git, which pinned revisions point at,
- Kwerft's cluster-wide settings: projects, console settings, clusters, node pools, firewall rules, alert rules, notification channels, Git connections and backup plans.

It does not hold metrics and logs, `kube-system`, cert-manager or Velero itself.

Volume data is copied file by file (Velero's file-system backup with Kopia), so it works for local NVMe volumes and Cloud Volumes alike. The console's database is copied consistently just before each backup.

## Encryption and the recovery key

Everything Kwerft and Velero write to the bucket is encrypted with the recovery key:

- **Volume data** is encrypted by Kopia before it leaves the server.
- **Every other object** (apps, settings, secret values, tokens) is encrypted by the storage with a key derived from the recovery key (SSE-C, server-side encryption with a customer-provided key). The storage gets the key with each request and does not keep it.

So the bucket must support SSE-C. Hetzner Object Storage does. Kwerft checks this when you save the target and refuses a store that does not encrypt.

Object names and sizes are not encrypted: backup names and the names of the projects show up as folder names in the bucket.

The recovery key is 52 characters (A–Z and 2–7, shown in groups of four). Kwerft creates it when you first save the target and shows it **once**. Without it, no backup can be read, not even by you. It never changes in this version.

## Set up the target

1. In the Hetzner Console, create a bucket in Object Storage (keep it private) and an S3 access key and secret key for it.
2. In Kwerft, open **Settings** and scroll to **Backups**.
3. Enter the **Endpoint** (for Hetzner Object Storage `https://<location>.your-objectstorage.com`, for example `https://fsn1.your-objectstorage.com`), the **Bucket**, and the **Access key** and **Secret key**. **Region** is taken from a Hetzner endpoint when left empty. **Prefix** is the folder in the bucket; it defaults to the console's hostname. Two consoles must not share one prefix.
4. **Check connection** confirms that the keys can list, write and delete in the bucket and that the store encrypts with SSE-C. It also says whether the prefix is empty or already holds backups.
5. Click **Save and start backups**.

Kwerft then shows the recovery key in **Store the recovery key**. **Copy** it or **Download as a file**, put it somewhere safe outside this server (a password manager), tick **I stored the recovery key** and click **Done**. The dialog does not close before that, and Kwerft cannot show the key again.

The first save also creates the plan `cluster`: everything, daily at 03:00 UTC, each backup kept 14 days, with volume data.

The card then shows the target's state (**Ready**, **Checking the bucket**, **Not working**) and the last successful backup. The access keys are write-only: Kwerft stores them and never shows them again; enter new ones to replace them.

**Use the recovery key of earlier backups** is for a console rebuilt by hand next to backups it made before: enter the old key instead of getting a new one. Kwerft refuses a new key for a prefix that already holds backups.

## Plans

Open **Backups** (in the sidebar under Infrastructure). The **Plans** table lists each plan with its schedule, how long it keeps backups, its last backup and its next run.

- **Back up now** starts a backup of the plan at once, also when the plan is paused.
- **Edit** changes a plan. **Delete…** deletes the plan and keeps its backups.

**New plan** asks for:

1. **Name** (lowercase letters, digits and dashes, up to 40 characters).
2. **What it backs up:** **Everything** (what `install.sh --restore` needs on a new server) or **Some projects** (their apps, jobs, volumes and secrets).
3. **Schedule (cron, UTC)**, five fields such as `0 2 * * *`.
4. **Keep each backup**, such as `14d` or `72h`. Velero deletes older backups.
5. **Back up volume data**: off backs up only the objects (apps, settings, secrets).
6. **Paused**: no scheduled runs; **Back up now** still works.

Schedules are in UTC; the times on the page are in your time zone.

The **Backups** table lists what is in the bucket: when each backup started, how long it took, its projects, objects, volume data size, status (**Completed**, **Partially failed**, **Failed**) and when it expires.

## Restore in the console

Click **Restore…** on a completed backup:

1. Pick the **Project**.
2. **What:** **The whole project**, or **Some apps**, with their volumes, secrets and domains. Apps that no longer exist can be named by hand.
3. **Where:**
   - **Into a new project**, next to the original. The new project is created with the original's settings. Public hostnames stay with the original project: give the copy hostnames of its own.
   - **Into** the original project: only what no longer exists comes back. Nothing that exists is overwritten.
4. Click **Restore**.

Restores are listed under **Restores** with their status. Restores of a single project or app come from either kind of plan. Every restore is recorded in the audit log.

## Restore the whole console onto a new server

When a server is lost, rebuild it from the newest Cluster backup on a fresh server:

1. Create a fresh Ubuntu server that meets the [requirements](/docs/requirements).
2. Put the keys into files on it, readable by root only: the access key, the secret key, and the recovery key. The file from **Download as a file** works as it is.
3. Write a config file, for example `/root/kwerft.yaml`:

```yaml
backups:
  endpoint: https://fsn1.your-objectstorage.com
  region: fsn1                        # optional for Hetzner endpoints
  bucket: acme-kwerft
  prefix: ops.example.com             # the prefix Settings showed
  accessKeyFile: /root/s3.access
  secretKeyFile: /root/s3.secret
  recoveryKeyFile: /root/kwerft-recovery-key.txt
```

4. Run the installer of the same release with `--restore`:

```bash
curl -fsSL https://kwerft.dev/v0.6.0-rc.3/install.sh | sudo bash -s -- --config /root/kwerft.yaml --restore latest --yes
```

`--restore latest` takes the newest complete Cluster backup; `--restore <name>` takes a named one (the names are on the Backups page). The installer builds the platform as usual, then restores the backup in its own **Restore** stage before the Kwerft stage. Volume data can take a while; the installer waits up to four hours and prints its progress.

Afterwards:

- The console has its old hostname, unless you give `--domain`. Its certificates come back with it.
- Everyone signs in with their existing accounts. There is no setup token.
- With [managed DNS records](/docs/domains-and-tls#managed-dns-records), Kwerft points them at the new server by itself. Otherwise the installer's summary lists the names to point at the new address.
- New backups go to the same prefix.

`--restore` is refused on a server that already runs Kwerft (restore single projects in the console instead), with `--lite` (which leaves Velero out), and with `--agent` or `--join`. A restore that fails ends with exit code 60; the message says why, for example a bucket the keys cannot read, or no backup Velero can decrypt with this recovery key. Fix the cause and run the same command again: it continues with the same restore. See [Troubleshooting](/docs/troubleshooting#a-restore-fails-with-exit-code-60).

## etcd snapshots

k3s keeps snapshots of the cluster state (etcd) on the first server: every 6 hours, the newest 28. These are local and need no setup.

With **Send k3s's etcd snapshots to the bucket too** (on by default for a new target), an agent on every control-plane node uploads each snapshot to `<prefix>/etcd/<node>/`, encrypted with a key derived from the recovery key. **Snapshot schedule** and **Snapshots kept** change both; a new schedule takes effect when the installer runs again on the first server. Settings shows, per node, **Uploaded**, **Failing** (with the error) or **None yet**.

An etcd snapshot restores the cluster state only (every Kubernetes object), not volume data or the console's database: that is what `install.sh --restore` is for. For the rare case where you need one, `kwerft etcd-snapshot` reads them back with the same `backups:` config and key files:

```bash
kwerft etcd-snapshot list  --config kwerft.yaml
kwerft etcd-snapshot fetch --config kwerft.yaml --name latest
```

The binary is `/usr/local/bin/kwerft` in the console image `ghcr.io/ehilzinger/kwerft:<version>`, for example:

```bash
docker run --rm --user 0 -v /root:/root -w /root ghcr.io/ehilzinger/kwerft:0.6.0-rc.3 \
  etcd-snapshot fetch --config kwerft.yaml --name latest
```

Then, on the server, with k3s stopped:

```bash
k3s server --cluster-reset --cluster-reset-restore-path=/root/<snapshot>.zip --token=<the old server's token>
```

The token is in `/var/lib/rancher/k3s/server/token` on the old server, and in every Cluster backup (Secret `kwerft-system/cluster-local-join`). Without it, k3s cannot read the snapshot's certificates and secrets.

## Alerts

Two default alert rules watch backups (see [Monitoring › Alert rules](/docs/monitoring#alert-rules)):

- **backup-failing**: a plan's latest backup failed.
- **backup-missing**: a plan has not completed a backup within twice its interval.

Both are critical and notify nobody until you pick a channel in the rule.

## Limits

- Not yet tried against real Hetzner Object Storage, and the full restore has not run end to end on real servers.
- Only the cluster `local`, where the console runs, is backed up. Connected clusters run no Velero, so their projects are not backed up yet.
- A full restore brings back one server. Node pools and connected clusters come back as settings; rebuilding a cluster of several servers from a backup is not covered yet. `--restore` also needs the console's volume on the default local storage.
- The recovery key cannot be changed yet.
- Velero's own `velero backup logs` and `describe --details` do not work with the encrypted bucket. Read Velero's log with `kubectl -n velero logs deploy/velero` instead.
- An app restored into a new project keeps its public hostnames, which the original still claims. Give the copy hostnames of its own.
