---
title: Clusters & nodes
description: Connect Hetzner Cloud, add servers as node pools, join dedicated servers, make the control plane highly available, run builds on their own servers, and manage more clusters from one console.
group: Operate
order: 4
---

You start with one server, which is the cluster `local`. From **Clusters & nodes** you can add servers to it, make its control plane highly available, and connect more clusters, in other locations or on other servers, to the same console. Owners and admins manage clusters and nodes; other roles only see which cluster a project runs in.

<div class="note">Everything on this page needs Kwerft v0.5.0, which is in release candidates. The default install command installs v0.4.0; to try these features, <a href="/docs/installer#pin-a-version">pin v0.6.0-rc.4</a>, the newest release candidate, which contains them. They are tested on Hetzner Cloud servers and with simulated Hetzner APIs; a cluster that keeps serving apps while it loses a node is still being verified on real servers.</div>

## Connect Hetzner Cloud

Node pools, new Cloud clusters, Cloud Volumes, the Load Balancer and the Cloud Firewall all work through the Hetzner Cloud API.

1. In the Hetzner Console, open the project your servers run in, then **Security › API tokens**, and create a token with **Read & Write**.
2. In Kwerft, open **Settings › Hetzner Cloud API** and paste it as **Cloud API token**.

Kwerft checks the token, tells you which of the project's servers are this cluster's nodes, stores it and never shows it again. **Remove token** stops Kwerft from managing anything in the project; what it created there stays. You can also pass the token at install time with `hcloud.tokenFile` in the [config file](/docs/installer#config-file).

Dedicated servers are not affected by any of these settings.

### Cloud Volumes

Volumes of the class **Hetzner Cloud Volume** need the Hetzner CSI driver. The installer adds it on Cloud servers whenever it knows a token: after storing the token in Settings, re-run your install command on the Cloud server. Settings then shows **Cloud Volumes: Available (storage class hcloud-volumes)**, and the Volumes page offers the class.

A pod with a Cloud Volume is never scheduled onto a dedicated server. Local NVMe stays the default class.

### Load Balancer

**Put a Hetzner Load Balancer in front of the ingress**, under Settings › Hetzner Cloud API, creates a Load Balancer (type `lb11` unless you choose another **Type**, in the first server's **Location** unless you set one) that forwards TCP 80 and 443 to the Cloud servers over the private network. It passes client addresses on with the PROXY protocol, so apps, the audit log and the firewall's lock-out check still see real addresses.

It needs a Cloud server in a Hetzner Cloud Network, with the installer run on it. Once a server passes its health check, managed DNS records move to the Load Balancer's addresses. Turning it off moves DNS back at once and deletes the Load Balancer ten minutes later. The Load Balancer costs extra in your Hetzner project.

### Cloud Firewall

See [Network › Hetzner Cloud Firewall](/docs/network#hetzner-cloud-firewall).

### Cloud controller manager

The Hetzner cloud-controller-manager is optional; nothing in Kwerft needs it. It can only be chosen when a cluster is first installed, with `hcloud.cloudControllerManager: true` in the config file, because nodes cannot change their provider ID later.

## Nodes

Open **Clusters & nodes**, a cluster, then the **Nodes** tab. The table lists each node with its role, status, addresses, size and pool:

- **Drain** moves its pods elsewhere and keeps new ones off; **Uncordon** lets them back.
- **Remove** drains the node (respecting disruption budgets for up to 15 minutes), takes a control-plane node out of etcd, and removes it from the cluster. A node holding local volumes is only removed if you tick the force option; their data is lost.

A removed server that is not in a node pool must be switched off with `install.sh --uninstall`, or it registers again.

## Node pools

A node pool is a group of Hetzner Cloud servers of one type that Kwerft creates, joins and replaces. Click **Add node pool**:

1. **Name**, such as `workers`. Servers are named `<cluster>-<pool>-<random>`.
2. **Role:**
   - **Workers:** apps run here.
   - **Control plane:** k3s servers with embedded etcd (see below).
   - **Builds:** only Git builds run here.
3. **Location** and **Server type**. All servers of a cluster share one network zone. The form shows the monthly price.
4. **Servers** (for builds, **At most**), and optional **Node labels** (`key=value`, one per line).

Servers get the newest Ubuntu LTS, join the cluster's Cloud Network and are spread across hosts with a placement group. They get the SSH keys of your Hetzner project that carry the label `kwerft.dev/ssh-key`, or all of them if none does. Each server goes from Creating to Joining to Ready in a few minutes.

The console's own server must be in a Hetzner Cloud Network for pools of the `local` cluster. Kwerft finds the network by the label `kwerft.dev/cluster=local`, by the name `kwerft-local`, or because the installer recorded it when it ran with a Cloud token.

- **Scale** changes the count. Scaling down drains and deletes the newest servers first (broken ones before them).
- Changing the server type adds a new server first, then drains and deletes an old one, one at a time.
- A worker or build node that stays NotReady for 15 minutes is drained and replaced. From v0.6.0-rc.1, Kwerft replaces one broken server at a time, and none while most of the cluster's nodes are NotReady, since that points at the cluster or its network rather than at the servers. A server that never becomes a node within 20 minutes is marked failed, not deleted: **Replace** deletes it and creates a new one. Its log is `/var/log/kwerft-join.log` on that server.
- While an [upgrade](/docs/upgrades) of the cluster runs, node pool changes wait for it. New servers install the k3s version the cluster runs, not the one the release pins.
- Deleting a pool drains its servers one by one and deletes them at Hetzner. Data on their local volumes is lost.

Kwerft only ever deletes Cloud servers that carry its labels for that cluster and pool.

### High-availability control plane

A single control-plane server is a single point of failure: while it is down, so is the cluster's API. For high availability, run three control-plane nodes: add a **Control plane** pool so that the cluster has three in all.

Control-plane servers run etcd, so the count must stay odd. Kwerft refuses an even number and never removes the last one. They join one at a time and leave one at a time, and only while every other control-plane node is Ready. Control-plane nodes are never replaced automatically.

### Build pools

A **Builds** pool keeps Git builds off the servers that run your apps. Its nodes are tainted so that only build jobs land there. The pool starts servers when builds are queued, up to its count, and stops them after **Stop after idle (minutes)** without builds (15 by default). The first build waits about 3–5 minutes for its server; the 30-minute build timeout includes that wait.

## Join a dedicated server

Dedicated (Robot) servers, and any other Ubuntu 22.04, 24.04 or 26.04 server on the cluster's private network, join with a command:

1. On the cluster's **Nodes** tab, under **Join a server**, choose **Worker** or **Control plane** and how long the command stays **Valid for** (30 minutes to 24 hours).
2. Click **Create join command** and run it as root on the new server:

```bash
curl -fsSL https://ops.example.com/join.sh | sudo bash -s -- --token kwft_join_… --role worker
```

It installs k3s with Kwerft's settings and joins; the node appears within a minute. The command works for any number of servers until it expires, and holds no Kubernetes credential itself: the console hands one out when a server joins. Control-plane join commands are for owners only, because the server receives the cluster's k3s server token.

The new server must share a private network with the cluster: the same Hetzner Cloud Network, or a Hetzner vSwitch coupled to it.

### Couple a vSwitch (API only)

Kwerft can couple dedicated servers to the cluster's Cloud Network through a Robot vSwitch. There is no form for it yet, and it has only been tested against a simulated Robot API. Owners call the console API with an API token with the owner role:

```bash
curl -X POST https://ops.example.com/api/v1/clusters/local/vswitch \
  -H "Authorization: Bearer kwft_…" -H "Content-Type: application/json" \
  -d '{"robotUser": "…", "robotPassword": "…", "vlan": 4000,
       "ipRange": "10.0.64.0/24", "servers": ["203.0.113.10"]}'
```

The Robot webservice credentials are used once and never stored. Kwerft creates a vSwitch `kwerft-<cluster>` (or uses `vswitchId`), adds the servers (by main IPv4 address or server number) and adds the range as a vSwitch subnet to the Cloud Network (`networkZone` defaults to `eu-central`). Then, on each dedicated server, set up a VLAN interface on the vSwitch's VLAN with an address in that range, MTU 1400 and a route to the network via the subnet's gateway (`.1`), as in Hetzner's guide to connecting dedicated servers, and run the join command.

## More clusters

The **Clusters & nodes** page lists every cluster with its provider, state, nodes and versions. Remote clusters run Kwerft without a console of their own, as an agent that dials out to your console over HTTPS. Their Kubernetes API is never exposed.

### Create a cluster on Hetzner Cloud

With a Cloud API token stored, click **Create on Hetzner Cloud**:

1. **Name** (used in server names, cannot change) and an optional display name.
2. **Location**: Falkenstein, Nuremberg, Helsinki, Ashburn, Hillsboro or Singapore.
3. **Server type** for the control plane, such as `cx32`.
4. **Control plane:** **1 server** (cheapest) or **3 servers** (survives losing one).

Kwerft creates a Cloud Network `kwerft-<name>` and the first server, which installs Kwerft in agent mode and connects; the other control-plane servers join after it. Add worker pools on the cluster's Nodes tab. Such a cluster uses the console's Cloud API token, and its page has its own Cloud Firewall and Load Balancer settings.

### Adopt an existing server

For a dedicated server, or a server elsewhere, click **Adopt a cluster**, enter a name and click **Add cluster**. Kwerft shows an install command once; run it as root on a fresh Ubuntu 22.04, 24.04 or 26.04 server with 4 GB of RAM or more:

```bash
curl -fsSL https://kwerft.dev/v<console version>/install.sh | sudo bash -s -- --agent --console https://ops.example.com --cluster-token kwag_… --version <console version>
```

The command downloads the installer of the console's own version, so the server gets the same release as the console.

<div class="warn">A console on v0.5.0-rc.3 or earlier shows a command that downloads <code>…/main/install.sh</code>, the latest stable script, which is still v0.4.0's: it does not know <code>--agent</code> and stops with "Unknown option". Replace the URL with the console's own version's script, <code>https://kwerft.dev/v&lt;console version&gt;/install.sh</code>, and keep the rest. Consoles on v0.6.0-rc.1 and later show the right URL.</div>

It installs the same stack as a normal install (k3s, Cilium, Traefik, cert-manager, monitoring) without a console, and the cluster appears under Clusters within a minute. All it needs is outbound HTTPS to the console. More servers join it from its own Nodes tab.

### Work with remote clusters

- **Projects** choose their cluster when they are created (**New project › Cluster**) and stay there. Project names are unique across all clusters, and every list in the console shows which cluster an item belongs to.
- **Builds** of a remote cluster's apps run in that cluster. Git connections and notification channels are defined once in the console and copied to every connected cluster; webhooks still arrive at the console.
- **Monitoring:** each cluster keeps its own metrics, logs and alerts, which the console reads through the agent.
- **DNS:** apps in a remote cluster can use names under the console's apps domain, and the console points their DNS records at that cluster. See [Domains & TLS › Remote clusters](/docs/domains-and-tls#remote-clusters).
- If a cluster cannot be reached, the console says so and shows the rest.
- **Upgrades:** from v0.6.0, a connected cluster's Kwerft and Kubernetes are upgraded from the console's **Settings › Updates**, and **Upgrade all** takes every cluster along after the console. See [Upgrades › Connected clusters](/docs/upgrades#connected-clusters).
- **Backups** (v0.6.0) cover the cluster `local` only; connected clusters are not backed up yet.

A cluster's **Overview** shows its health, Kubernetes and Kwerft versions, and where its agent connects from. **Rotate agent token** gives you a new install command and disconnects the old agent; re-run the command on one of the cluster's servers. **Delete** disconnects the agent and revokes its token. For a cluster created on Hetzner Cloud it also deletes every server, with all projects, apps and data on them. For an adopted cluster it deletes only the Cloud servers Kwerft created for its node pools; the other servers keep running, without a console.

## Limits

- The console itself runs as a single replica on the `local` cluster; the console is unavailable while that cluster's control plane is down. From v0.6.0 it can be [rebuilt on a new server](/docs/backups#restore-the-whole-console-onto-a-new-server) from a backup, as a single server.
- Agents reconnect within about a minute after the console restarts.
- Kwerft for Mac, which runs the same projects in a local cluster on a Mac, is planned after the public beta.
