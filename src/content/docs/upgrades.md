---
title: Upgrades
description: Upgrade Kwerft from the console with automatic rollback, upgrade Kubernetes node by node, take connected clusters along with Upgrade all, and choose an update policy and channel.
group: Operate
order: 6
---

Kwerft upgrades itself from the console. Owners start an upgrade under **Settings › Updates**; Kwerft takes a backup, runs the new release's installer on the server, checks the result, and rolls back by itself if anything fails. Kubernetes (k3s) is upgraded separately, one node at a time.

<div class="note">Upgrades from the console need Kwerft v0.6.0, which is in release candidates. The first upgrade from the console is possible from a console that already runs 0.6.x: to get from v0.4.0 or v0.5.0 to v0.6.0, <a href="#upgrade-from-v04-or-v05">re-run the installer</a> once. Rollbacks and Kubernetes upgrades have been tested against simulated clusters; the end-to-end runs on real servers have not run yet.</div>

Owners start and cancel upgrades and change the update policy. Admins see **Settings › Updates** and the history but cannot start anything. Other roles do not see the tab.

## Settings › Updates

**Settings** has two tabs, **General** and **Updates**. When a release is available, the Updates tab and Settings in the sidebar get a dot, and the Overview's **Needs attention** lists "Kwerft X available".

The Updates tab has these cards:

- **Versions:** for each cluster, what runs (**Kwerft** and **Kubernetes (k3s)**) and what is available, marked **patch** or **minor**. **Check now** looks for releases at once; **Upgrade…** starts one.
- **Release notes** of the available Kwerft releases.
- **Update policy**: see [below](#update-policy).
- **History**: past upgrades with who started them, how long they took and how they ended. The newest 20 per cluster are kept.

Kwerft reads releases from the public [ehilzinger/kwerft-install](https://github.com/ehilzinger/kwerft-install) repository: a plain download, with nothing about your install in the request.

## Upgrade Kwerft

1. Click **Upgrade…** on the Kwerft row. If several releases are available, pick the **Version**.
2. The dialog runs a **Preflight** right away: the release exists and may be upgraded to from your version, its image can be pulled, every node is Ready, there is enough disk, and nothing else (another upgrade, a node pool change) is running. A failed check blocks the upgrade and says why; **Check again** repeats it.
3. Enter **Your password**, or a current code from your authenticator app. Accounts that use single sign-on need to have signed in within the last 10 minutes.
4. Click **Upgrade to &lt;version&gt;**.

The progress card then follows the upgrade, styled like the installer's output, one line per step:

1. **Backup:** a copy of the console's database, an etcd snapshot and the current revision of every Helm release.
2. **Installer:** the new release's `install.sh`, downloaded and checked against its published SHA-256 checksum, runs on the server with the settings the server remembers. Each installer stage gets a line. **Show the installer log** shows the last 64 KiB of `/var/log/kwerft/install.log`.
3. **Verify:** the console answers with the new version, Kwerft's resource types are in place, the node agent is rolled out, the console's hostname answers with a valid certificate, no app has fewer ready replicas than before, and Hubble is ready (where it runs).

Apps keep serving throughout. The console itself restarts for a few seconds: the page shows **Reconnecting…**, then offers **Reload** for the new version.

**Cancel upgrade** is possible until the installer starts. After that, an upgrade either succeeds or rolls back.

### Automatic rollback

If the installer fails or a check after it fails, Kwerft rolls every component it changed back to the revision it had before (Kwerft first, Cilium last), checks the console on the old version, and ends with **RolledBack**. If the rollback itself fails, the upgrade ends **Failed** and its message lists the commands to finish by hand.

Not rolled back: Kwerft's resource definitions (they only ever gain fields, so the old version still reads them), changes on the host (packages, sysctls, firewall), and the system-upgrade-controller. Components that are new in the target release stay installed.

Some releases cannot be rolled back without also restoring the console's database. Their dialog asks you to tick **Accept a data rollback**: if such an upgrade fails, changes made in the console since the backup are lost.

## Upgrade Kubernetes

Kubernetes (k3s) is upgraded on its own, with the **Upgrade…** button on the Kubernetes row:

- Kwerft only offers k3s versions that a Kwerft release pinned and tested, at most one minor version ahead of what runs. A version appears once a Kwerft release you run pins a newer k3s.
- The preflight checks that every node is Ready and on the same version, that etcd is healthy, that the disk has room, and, for a minor version, that nothing in the cluster still uses an API that the new version removes.
- An etcd snapshot is taken first. Then the control-plane nodes are upgraded one at a time, then the workers, one at a time. Workers are drained first; a worker that is alone in its node pool is only cordoned, since its pods have nowhere else to go. The progress card shows each node.
- A patch upgrade asks for your password. A minor upgrade also asks you to **Type &lt;version&gt; to confirm**.

<div class="warn"><b>Kubernetes cannot be rolled back automatically.</b> k3s does not downgrade, and restoring etcd resets every object in the cluster. If a node fails, Kwerft stops before the next one and the upgrade ends <b>Failed</b>, naming the node and the snapshot. Nodes one minor version apart keep working together, so the usual fix is to find the cause (<code>kubectl -n system-upgrade logs job/&lt;job&gt;</code>) and upgrade again. Going back to the snapshot is a manual procedure: stop k3s on every node, put the old k3s binary back on the upgraded ones, run <code>k3s server --cluster-reset --cluster-reset-restore-path=&lt;snapshot&gt;</code> on the server marked <code>kwerft.dev/installer=true</code>, then start the others again.</div>

With a single control-plane server, the Kubernetes API is down while that server restarts, as with any k3s upgrade; apps keep running.

## Connected clusters

Connected clusters run their own Kwerft (the agent) and their own k3s. Both are upgraded from the same page; the Versions table has a row pair per cluster.

- **Upgrade all to &lt;version&gt;…** upgrades the console first, then each connected cluster, one after another. The dialog lists the order and the clusters it leaves out, and why (disconnected, or already on that version). Each cluster rolls back by itself if it fails, and a cluster that fails or rolls back stops the rest: the ones still waiting are cancelled before anything changes there.
- A single cluster can be upgraded on its own row, but never past the console's version.
- The console works with clusters on its own minor version and the one before. A console upgrade that would leave a connected cluster two minor versions behind is refused: upgrade that cluster first.
- Kubernetes is upgraded per cluster, never across clusters at once.
- A cluster that runs a Kwerft from before 0.6 cannot be upgraded from the console: the row says to re-run the installer on its server.

## Update policy

The **Update policy** card applies to every cluster:

| Policy | What it does |
|---|---|
| **Off** | No release checks and no outbound requests. Upgrade by re-running the installer. |
| **Notify** (the default) | Check for releases every 6 hours and show them on this page and on the Overview. Every upgrade is a click. |
| **AutoPatch** | Also install patch releases of the running minor version in a maintenance window. Minor releases always need a click. |

**Channel** is **stable** (releases) or **edge** (release candidates too).

With **AutoPatch**, choose the maintenance window: the **Days**, when it **Starts at**, how long (**For**, 1 to 8 hours) and the **Time zone** (an IANA name such as `Europe/Berlin`; empty means UTC). An upgrade that has not started by the end of the window waits for the next one. **Also Kubernetes patch versions** lets AutoPatch install k3s patch versions too, after Kwerft's; minor versions of Kubernetes never install by themselves.

Turning AutoPatch or Kubernetes patches on asks for your password, since upgrades then run without anyone clicking. Click **Save policy**.

If an automatic upgrade fails or rolls back, AutoPatch pauses: the page says so and nothing installs by itself until an owner clicks **Resume AutoPatch**.

## Alerts

The default alert rule **upgrade-failed** fires when the latest upgrade of Kwerft or Kubernetes failed or was rolled back, and links to Settings › Updates. Like every default rule, it notifies nobody until you pick a channel in it. See [Monitoring › Alert rules](/docs/monitoring#alert-rules).

## Upgrade from v0.4 or v0.5

Consoles on v0.4.0 and v0.5.0 have no Updates tab. Upgrade them once by running the installer of the release you want on the console's server, as root. The same goes for consoles on v0.6.0-rc.1 and rc.2: their upgrade runner is refused by systemd on Ubuntu ("Access denied" in the Backup step), so move them to rc.3 or later this way once; console upgrades work from rc.3 on.

```bash
curl -fsSL https://kwerft.dev/v0.6.0-rc.4/install.sh | sudo bash -s -- --yes
```

Give the same flags as when you installed (for example `--acme-server staging` or `--lite`): servers installed before 0.6 have no remembered settings yet, so this one run needs them. From then on the server remembers them (see [Installer › Re-run](/docs/installer#re-run-to-repair-or-upgrade)), and the console can upgrade itself.

From v0.6.0-rc.4, a re-run also leaves a copy of the console's database: the first time a new version starts, the console copies its database before migrating it, to `backups/pre-<version>-from-<previous>.db` on its data volume (the newest three are kept).

The re-run upgrades Kwerft and the platform components, and adds Velero (for [backups](/docs/backups)) and the system-upgrade-controller. It does not change the k3s version, but restarts k3s once to turn on its etcd snapshot settings; running containers keep running through a k3s restart.

Connected clusters are upgraded the same way: on the server where you ran the adopt command, run the new release's installer in agent mode. The agent token is read back from the cluster:

```bash
curl -fsSL https://kwerft.dev/v0.6.0-rc.4/install.sh | sudo bash -s -- --agent --console https://ops.example.com --yes
```

Upgrade the console first: it works with clusters one minor version behind it, not ahead of it.

## Limits

- Only owners start upgrades, and only from a console on 0.6.x.
- Kubernetes upgrades have no automatic rollback (above).
- The installer script is checked against its published SHA-256 checksum, which protects against a broken download, not against a compromised release repository. Signed scripts are planned.
- The end-to-end runs (a console upgrade, a forced rollback, k3s on three nodes) exist but have not run on real servers yet.
- AutoPatch only covers patch releases, and has not been tried with a real release yet.
