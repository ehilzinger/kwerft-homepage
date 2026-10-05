---
title: Network
description: Project isolation, traffic rules with live Hubble counts, the servers' host firewall with lock-out protection, and the Hetzner Cloud Firewall sync.
group: Operate
order: 2
---

Kwerft starts closed. Projects are isolated from each other, each app accepts only the traffic it needs, and the servers' firewall lets in SSH, HTTP and HTTPS. The **Network** page is where you open exactly the paths you need: **Traffic rules** between apps, the **Server firewall** on the hosts, and **Domains & TLS** (described on [Domains & TLS](/docs/domains-and-tls)).

## What is allowed by default

Network policies are enforced by Cilium, and traffic between nodes is encrypted with WireGuard.

An app accepts connections on its ports from:

- the ingress, for its public hostnames,
- Kwerft's own platform (the console, monitoring),
- the apps listed in its **Who may connect to this app inside the cluster?** setting, and their jobs.

Nothing else reaches it, not even other apps in the same project, until you allow it there or with a traffic rule. What an app may reach on the internet is its **Outbound access** setting: **None**, **HTTPS to internet** (the default) or **Unrestricted**. See [Apps](/docs/apps#who-may-connect-and-where-the-app-may-go).

### Project isolation

Projects are isolated by default: pods in other projects cannot reach a project's apps unless a rule on the receiving side allows it. Owners and admins can turn this off per project with the switch **Isolate &lt;project&gt; from other projects** on the Traffic rules tab. A project that is not isolated accepts connections from every project's pods.

## Traffic rules

Traffic rules belong to a project. Open **Network › Traffic rules**, pick the project and click **New rule**:

1. **Name**, for example `web-to-api`.
2. **From** and **To**: one or more peers, each an **App** (`api`, or `project/api` for another project's), a **Project**, the **Internet** (through the ingress) or an **Address range** (`10.0.0.0/16`).
3. **Ports**, comma-separated, with ranges such as `9000-9010`. Empty means every port.
4. **Protocol:** TCP or UDP.
5. An optional **Description**. **Disabled** keeps the rule but allows nothing.

A rule either lets this project's apps receive (its **To** side is in this project) or lets them send out (its **From** side is this project's apps). Rules only ever add access; they never cut an app off from what its own settings allow.

### Across projects

A rule in one project never changes another project. If project `web`'s rule lets its app reach `api` in project `billing`, `billing` has to allow it too: with a rule of its own, an entry `web/<app>` in the app's "who may connect", or by not being isolated. Until then the rule shows **Waiting for the other project**.

### Allowed and dropped counts

Kwerft reads Hubble, Cilium's flow log, and shows for each rule how many connections it allowed in the last hour (**Allowed, 1 h**) and how many connections between its sources and destinations were dropped, for example on a port the rule does not list (**Dropped**).

When connections into the project were dropped, a banner names the busiest one, and **Dropped in the last hour** lists them all. **Create allow rule** opens the rule form already filled in for that connection. Review it before you save.

Counts start when the console starts and are not kept across restarts. Servers installed with `--lite` run without Hubble, so they show no counts.

Developers create and change traffic rules in their projects; viewers see them.

### Rule states

| State | Meaning |
|---|---|
| Active | Applied |
| Applying | Being applied |
| Disabled | Kept, but allows nothing |
| Waiting for the other project | The receiving project has not allowed it yet |
| No such app yet | An app the rule names does not exist (yet) |
| Invalid | The rule cannot be applied; nothing of it is |

## Server firewall

**Network › Server firewall** is the firewall on the servers themselves, for owners and admins. You need it for SSH and for services that listen on the servers outside Kubernetes. Apps get their traffic through the ingress and need no rule here.

The installer sets up a baseline that stays in place whatever you do here: established connections, the private network and pods, WireGuard, and TCP 22, 80 and 443 from anywhere. On top of that you can narrow who reaches SSH and open more ports. You cannot close HTTP(S), the cluster's own traffic or SSH from the private network.

The table lists every rule with port, protocol, source, purpose, which nodes it applies to and its status. Rules marked **required** come with Kwerft (`ssh`, `http`, `https`, `wireguard`, `icmp`, `cluster-private`); of those, only the SSH rule's sources can change.

### Open a port

1. Click **Add rule**.
2. Enter a **Name** (it cannot change later), the **Protocol**, the **Port** and, for a range, **Up to**.
3. **Allowed from:** one IPv4 or IPv6 address or range per line. Empty means anyone on the internet.
4. **Applies to:** **All nodes** or **Control plane**.
5. A **Purpose**, and **Enabled**.

Kwerft refuses ranges over 22, 80, 443 and UDP 51871, and opening the Kubernetes API, etcd or kubelet ports to everyone.

### Narrow SSH

Click **Sources** on the `ssh` rule. In **Who may connect with SSH**, untick **Anyone on the internet** and list the addresses under **Only from**. The dialog says whether your current address keeps SSH access, and Kwerft refuses a change that would lock you out. If a proxy hides your real address, Kwerft does not narrow SSH from that browser at all.

### Lock-out protection

A change that only adds access (opening a port, adding an SSH source) applies at once. A change that takes something away is applied on the servers as pending, and a banner counts down:

- **Keep these rules** makes it permanent. Open a new SSH session first to check you still get in.
- **Roll back now** restores the rules as they were.
- If nobody keeps it within 60 seconds, every node rolls it back on its own, even if the console, Kubernetes or your browser is gone.

After a rollback, the page says so and offers **Apply again** or **Discard the change**. The nodes table at the bottom shows each node's firewall state and when it last reported.

### Rescue: locked out anyway

Open the server's console from Hetzner (the Cloud Console's VNC console, or a KVM console for a dedicated server), log in as root and run the installer with `--reset-firewall`:

```bash
curl -fsSL https://raw.githubusercontent.com/ehilzinger/kwerft-install/main/install.sh | sudo bash -s -- --reset-firewall
```

This removes Kwerft's firewall table and pauses the console's firewall rules on that node. Re-run your install command to restore the baseline. To let the console manage that node's firewall again, delete `/var/lib/kwerft/firewall/paused`.

### Things the host firewall cannot do

Cilium answers Kubernetes NodePort services before the host firewall sees the packets, so host rules neither open nor close NodePorts. Use the ingress for public services; on Hetzner Cloud, the Cloud Firewall below does close NodePorts.

## Hetzner Cloud Firewall

<div class="note">Needs Kwerft v0.5.0, which is in release candidates, and a Hetzner Cloud API token (Settings › Hetzner Cloud API).</div>

On Hetzner Cloud servers, Kwerft can mirror the server firewall to a Hetzner Cloud Firewall, which filters traffic before it reaches the servers. Tick **Mirror the server firewall to a Hetzner Cloud Firewall** under **Settings › Hetzner Cloud API**.

- Kwerft keeps one Cloud Firewall per cluster, named `kwerft-<cluster>-…`, applied to the cluster's Cloud servers. Dedicated servers are never added; they have the host firewall only.
- It carries the rules **as the nodes last confirmed them**. A pending change reaches the Cloud Firewall only after you keep it; SSH, HTTP, HTTPS, WireGuard and ICMP always stay open.
- Rules edited by hand in the Hetzner Console are put back. Each rule on the Server firewall tab shows its Cloud state.
- A Cloud Firewall holds at most 50 rules; with more, Kwerft leaves it as it is and reports an error.
- Unticking the option detaches and deletes the Cloud Firewall. Uninstalling Kwerft leaves it in your Hetzner project: delete it there (detach it first), or untick the option before you uninstall.

For a Hetzner Cloud cluster created from the console, the same switch is on that cluster's page under **Clusters & nodes**. See [Clusters & nodes](/docs/clusters-and-nodes).
