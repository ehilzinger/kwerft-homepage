---
title: Troubleshooting
description: Answers for the problems people run into most, from DNS and certificates to firewall lock-outs, a lost setup token, failed upgrades and restores, and where to find logs.
group: Reference
order: 2
---

Most problems come down to DNS, a firewall in the way, or a stage that did not finish. Re-running the installer fixes many of them on its own. The commands below run on the server; `sudo k3s kubectl` has full rights there.

## Where are the logs?

| What | Where |
|---|---|
| The installer | `/var/log/kwerft/install.log` |
| A server that a node pool created | `/var/log/kwerft-join.log` on that server |
| k3s | `sudo journalctl -u k3s` (on joined workers: `-u k3s-agent`) |
| The console | `sudo k3s kubectl -n kwerft-system logs deploy/kwerft` |
| Your apps and jobs | The app's or run's **Logs** tab, and **Monitoring › Logs** |
| Who changed what | **Access › Audit log** (owners and admins) |
| An upgrade (v0.6.0) | **Settings › Updates**, the upgrade's **Show the installer log**; on the server `/var/log/kwerft/install.log` |
| Backups (v0.6.0) | **Backups**; Velero's log: `sudo k3s kubectl -n velero logs deploy/velero` |

## The installer stopped

The last lines name the stage that failed, its exit code and the log. Fix the cause and run the **same command** again: completed stages are skipped or converge, so a re-run picks up where it stopped.

Common preflight stops (exit code 10):

- **Port 80 or 443 is already in use.** Stop the service using it (often nginx or Apache) and re-run.
- **Ubuntu version or architecture.** Kwerft needs Ubuntu 22.04, 24.04 or 26.04 on amd64 or arm64.
- **Memory or disk.** At least 4 GB of RAM (8 GB recommended, or `--lite` for 4 GB) and 30 GB free on `/`.

Exit code 50 with "is not published" means the `--version` you asked for does not exist. See [Pin a version](/docs/installer#pin-a-version) and the [exit codes](/docs/installer#exit-codes).

## The domain does not point at the server yet

The installer warns: `ops.example.com resolves to '…', expected <ip>`. The install itself finishes; only the certificate waits. Create or fix the A record, then wait. cert-manager keeps retrying, and the certificate is issued once the name resolves to the server.

```bash
dig +short ops.example.com
sudo k3s kubectl get certificates -A
```

Until then, the browser shows a certificate warning or cannot connect. If you have no DNS yet, install without `--domain` to get a working `<ip>.sslip.io` hostname, and move to your own name later under **Settings › Console domain** ([how](/docs/domains-and-tls#move-the-console)).

If the name resolves but the certificate still fails, check that TCP port 80 reaches the server: Let's Encrypt validates over HTTP. A Hetzner Cloud Firewall of your own must allow 80 and 443.

## Let's Encrypt rate limits

Let's Encrypt issues at most 50 certificates per week per registered domain, and 5 per week for the same hostname. Reinstalling a server again and again with the same names runs into the second limit quickly, and each reinstall issues the console's certificate anew.

- For test servers, install with `--acme-server staging` (from v0.5.0). Staging certificates are not trusted by browsers, but the limits are generous. From v0.6.0 the server remembers the flag; with earlier releases, give it on every run.
- Use an apps domain with a DNS-01 wildcard certificate: one certificate covers every app. See [Domains & TLS](/docs/domains-and-tls).
- Within one install, a hostname that comes back within seven days reuses its old certificate.

**Network › Domains & TLS** shows each certificate's state; hover over **Failed** for the reason.

## The console is unreachable

1. Check DNS and port 443 as above.
2. Check that the console runs:
   ```bash
   sudo k3s kubectl -n kwerft-system get pods
   sudo k3s kubectl -n kwerft-system logs deploy/kwerft
   ```
3. Re-run your install command. It repairs the platform and the console.

If you just moved the console to a new hostname, the old one redirects for a day; sign in on the new name.

## I locked myself out with the firewall

A firewall change that removes access rolls back by itself after 60 seconds unless someone keeps it, and Kwerft refuses changes that would block SSH from the address you are using. If you are locked out anyway, open the server's console from Hetzner (VNC for Cloud servers, KVM for dedicated ones), log in as root and run:

```bash
curl -fsSL https://kwerft.dev/install.sh | sudo bash -s -- --reset-firewall
```

Then re-run your install command to restore the baseline firewall, and delete `/var/lib/kwerft/firewall/paused` once you want the console to manage that node's firewall again. See [Network › Lock-out protection](/docs/network#lock-out-protection).

## I lost the setup token

The setup token is in a file on the server:

```bash
sudo cat /etc/kwerft/setup-token
```

It is valid for 24 hours and only until the owner account exists. If the file is gone or the token expired, run your install command again: the installer creates a new token whenever none is valid and no owner exists yet. Once an owner exists, there is no setup token any more; sign in at the console's address instead.

If you installed with `--config`, no setup token is created, and current releases do not apply the config file's `owner` section. Run the installer once more without `--config` to get a token. See [Config file](/docs/installer#config-file).

## I lost my second factor, or my password

- **Lost phone or security key:** sign in with a recovery code. Or ask an owner or admin: under **Access › Members › Edit**, **Reset second factors** removes your passkeys, authenticator app and recovery codes, and you set up a new factor at the next sign-in.
- **Passkeys stopped working after the console moved:** passkeys are bound to a hostname. Sign in with your password and authenticator app or a recovery code, then add a passkey again on the new name.
- **Forgotten password:** Kwerft does not send email yet, so there is no reset link. If single sign-on is set up, sign in with the provider instead. Otherwise an owner or admin can remove the account and invite you again; project memberships then have to be given again.

## An app does not answer on its hostname

- Does the hostname resolve to the server (or to the Load Balancer, if you use one)? A wildcard record for the apps domain covers all apps one level below it.
- Look at **Network › Domains & TLS**: is the certificate **Issuing** or **Failed**? With HTTP-01, a hostname gets a listener of its own, and there is room for 59.
- Another app may have claimed the hostname first; the older claim wins.
- Is the app running? Its **Overview** tab shows the replicas, their status and restarts; the **Logs** tab shows why it stops. A private image needs a **Registry credential**; an app without a health check gets traffic before it listens.

## Apps cannot reach each other

Kwerft denies traffic by default, even between apps in the same project. Add the caller to the target app's **Who may connect to this app inside the cluster?**, or create a traffic rule. **Network › Traffic rules** lists dropped connections from the last hour with **Create allow rule**. Across projects, the receiving project has to allow it too. See [Network](/docs/network).

## A build stays queued

One build runs at a time by default; the others wait. With a build pool, the first build waits about 3–5 minutes for a server to start. A build is stopped after 30 minutes. See [Builds from Git](/docs/builds#how-builds-run).

## Alerts do not reach Slack (or email, or ntfy)

Rules notify only the channels they name. Open the rule under **Monitoring › Alert rules** and pick the channel under **Notify**. **Send test** on the channel shows whether the destination accepts it and the error if not.

## An upgrade failed or rolled back

**v0.6.0.** Open **Settings › Updates** and click the upgrade in **History**. The progress card shows which step failed and why, and **Show the installer log** shows the end of the installer's log.

- **RolledBack:** the installer or a check after it failed, and Kwerft went back to the version before. Apps were not touched. Fix the cause the log names and start the upgrade again.
- **Failed** during the preflight or backup: nothing was changed. The message says which check failed, such as a node that is not Ready or too little disk (5 GiB free under `/var/lib` is needed).
- **Failed** after a failed rollback: the message lists the `helm rollback` commands to run on the server, and the names of the database copy and etcd snapshot taken before.
- A **Kubernetes** upgrade that failed is not rolled back. The nodes that were done stay on the new version, the rest on the old one, which works. See the node's job log with `sudo k3s kubectl -n system-upgrade logs job/<job>`, fix the cause and upgrade again. See [Upgrades › Upgrade Kubernetes](/docs/upgrades#upgrade-kubernetes).

If AutoPatch started the upgrade, AutoPatch is now paused until an owner clicks **Resume AutoPatch**.

A console on v0.4.0 or v0.5.0 has no Updates tab: upgrade it once by re-running the installer of the new version. See [Upgrades](/docs/upgrades#upgrade-from-v04-or-v05).

## Backups fail or the target is "Not working"

**v0.6.0.** The **Backups** card in Settings shows the target's state and the reason.

- **Check connection** names what the bucket refused: a wrong key, a bucket that does not exist, or a store that does not encrypt with SSE-C, which Kwerft requires.
- "Velero is not installed on this cluster": the server was installed with `--lite`, which leaves Velero out, or the Backups stage has not run. Re-run the installer without `--lite`.
- A backup that ends **Partially failed** lists its errors on the Backups page; Velero's log has the details. `velero backup logs` does not work with the encrypted bucket.

## A restore fails with exit code 60

**v0.6.0.** `install.sh --restore` stops with exit code 60 when it cannot read or restore the backup. The message says which:

- **Cannot read the backups:** the endpoint, bucket or keys in the `backups:` block are wrong, or the bucket is unreachable.
- **No complete Cluster backup:** check `backups.prefix` (it must be the prefix Settings showed, by default the old console's hostname). Backups are encrypted with a key derived from the recovery key: with the key file of another console, Velero lists none. Name a backup with `--restore <name>` to pick one yourself.
- **The restore failed or did not finish:** the message names the Velero restore to inspect, for example `sudo k3s kubectl -n velero get restore <name> -o yaml`.

Fix the cause and run the same command again: it continues with the same restore. `--restore` on a server that already runs Kwerft is refused with exit code 2; use a fresh server, or restore single projects from the console. See [Backups](/docs/backups#restore-the-whole-console-onto-a-new-server).

## The adopt command fails with "Unknown option: --agent"

The command a console on v0.5.0-rc.3 or earlier shows downloads the stable script, which is still v0.4.0 and has no agent mode. Replace the script URL in the command with the console's own version's, `https://kwerft.dev/v<console version>/install.sh`. Consoles on v0.6.0-rc.1 and later show their own version's script. See [Clusters & nodes](/docs/clusters-and-nodes#adopt-an-existing-server).
