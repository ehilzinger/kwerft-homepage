---
title: Concepts
description: Projects, apps, jobs, volumes, secrets, domains and clusters, how a change in the console reaches Kubernetes, and how to leave the console when you need to.
group: Start
order: 2
---

Kwerft is a console on top of a Kubernetes cluster it installed itself. Everything you create in the console is a Kubernetes resource of Kwerft's own kind, and Kwerft's controllers turn those resources into the Deployments, Services, routes, certificates and network policies Kubernetes runs. This page explains the building blocks and how they fit together.

## The building blocks

### Projects

A project groups apps that belong together, for example one per product or per environment. Each project is its own Kubernetes namespace with the same name, a resource quota, a Pod Security level and network isolation: by default, apps in other projects cannot reach it.

Owners and admins create projects (Apps › **New project**). A project's name becomes the namespace and cannot change later. By default every member of the team reaches every project with their console role; owners and admins can limit a project to named members. See [Access](/docs/access#project-access).

### Apps

An app is a long-running service: one container image, or a Git repository that Kwerft builds. It has replicas, a size (CPU and memory), environment variables, ports, optional public hostnames, volumes and a health check. Every change you save is a new revision you can roll back to. See [Apps](/docs/apps) and [Builds from Git](/docs/builds).

### Jobs: tasks and schedules

A task is a one-off run to completion, such as a migration or an import. A schedule starts tasks on a cron schedule. Both use the same shape as an app (image, command, environment, size, volumes), and a task can start from an existing app's image and settings. Tasks run at a lower priority than apps, so a busy server sheds batch work first. See [Jobs](/docs/jobs).

### Volumes

A volume is a disk in a project that apps and jobs mount by name: a job writes a file, a server reads it. Volumes live on the server's local NVMe disk, or as Hetzner Cloud Volumes on Cloud servers. See [Apps › Volumes](/docs/apps#volumes).

### Secret sets

A secret set is a named group of keys in a project, such as passwords and API keys. Apps and jobs use its values as environment variables or files; developers write values but never read them back. Kwerft can generate values and derive others from them, such as a connection string from a password. Secret sets need v0.6.0, which is in release candidates. See [Secrets](/docs/secrets).

### Domains

When you give an app's port a public hostname, Kwerft claims that hostname, adds an HTTPS listener and gets a Let's Encrypt certificate. The console's own hostname and an optional apps domain (so apps get names like `invoices.apps.example.com`) are set under Settings. See [Domains & TLS](/docs/domains-and-tls).

### Clusters and nodes

The server you installed on is the cluster `local`. You can add servers to it as nodes, and connect more clusters to the same console; each runs Kwerft's controllers itself and dials out to the console, so its Kubernetes API stays private. See [Clusters & nodes](/docs/clusters-and-nodes).

### Backups and upgrades

From v0.6.0, Kwerft backs up projects, their volumes and its own state to an S3 bucket, encrypted with a recovery key you keep a copy of, and can rebuild the whole console on a new server from it. It also upgrades itself from the console, rolling back by itself when an upgrade fails, and upgrades Kubernetes node by node. See [Backups](/docs/backups) and [Upgrades](/docs/upgrades).

## Kubernetes is the source of truth

The console keeps no copy of your apps. Its own small database (SQLite) holds people and sign-in data: users, sessions, API tokens and the audit log. Everything else is a custom resource in the `kwerft.dev` API group:

| Resource | What it becomes |
|---|---|
| `Project` | A namespace with quota, Pod Security level, default-deny network policy and role bindings |
| `App` | A Deployment (or a StatefulSet when each replica has its own disk), a Service, HTTP routes and a network policy |
| `Volume` | A PersistentVolumeClaim that apps and tasks mount |
| `SecretSet` | A Kubernetes Secret with write-only values, and the roles that let developers write but not read it (v0.6.0) |
| `Task`, `Schedule` | Kubernetes Jobs, started once or on a cron schedule |
| `Build` | A rootless BuildKit job that pushes to the in-cluster registry |
| `GitConnection` | Credentials and webhooks for a Git host |
| `Domain` | A Gateway listener and a certificate |
| `TrafficRule` | Cilium network policies between apps, projects and the internet |
| `FirewallRule` | Rules in the servers' host firewall |
| `AlertRule`, `NotificationChannel` | Alert rules and where notifications go |
| `ConsoleSettings` | The console hostname, apps domain and certificate method; from v0.6.0 also the backup target and the update policy |
| `Cluster`, `NodePool` | Connected clusters and groups of Hetzner Cloud servers |
| `BackupPlan`, `Restore` | Velero schedules and restores (v0.6.0) |
| `Upgrade` | One upgrade of Kwerft or Kubernetes, with its backup, progress and result (v0.6.0) |

Because these are ordinary Kubernetes objects, `kubectl get apps.kwerft.dev -n <project>` shows the same apps the console does, and `kubectl apply` of an App changes it just as the console's form would.

## How a change flows

When you press **Save & deploy** on an app:

1. The console's API checks your role.
2. It writes the `App` resource to Kubernetes **as you**: it impersonates `kwerft:<your email>` in the group of your role. Kubernetes RBAC is the final gate, so the console can never do more on your behalf than your role allows.
3. Kwerft's reconciler renders the Deployment, Service, routes and network policy with server-side apply.
4. The new status (rollout progress, ready replicas, certificate state) flows back to the console within seconds.

Every change is recorded in the audit log under your name. See [Security](/docs/security) for the details of this model.

## Never a dead end

The console is a convenience, not a lock-in. When it does not offer something yet, you can go around it:

- **YAML.** The deploy wizard ends with the App resource as YAML (**Copy YAML**), and a schedule's page shows **Schedule as YAML**. Keep them in a repository and apply them with kubectl.
- **A scoped kubeconfig.** Under Account › API tokens, **Download kubeconfig** gives you a kubeconfig that acts as you, with your role or less and optionally limited to some projects. It goes through the console's own proxy, so the Kubernetes API itself stays private. See [Access › kubectl](/docs/access#kubeconfig-and-kubectl).
- **Root on the server.** On the server itself, `sudo k3s kubectl` has full cluster-admin rights, as with any k3s install.

Shells are the one thing kubeconfigs cannot open: `kubectl exec` is refused through the proxy, because shells belong in the console, where they are recorded.

## Roles at a glance

There are four roles. Owners and admins manage everything; developers deploy and operate apps and jobs in the projects they reach; viewers look. The full matrix is on [Access](/docs/access#roles).

## What is new, and what is not built yet

Kwerft is pre-beta. The latest release is v0.4.0. The release candidate v0.6.0-rc.4 contains everything from the v0.5.0 candidates and adds what was missing for running Kwerft for real:

- [backups](/docs/backups) of projects, volumes and the console to Object Storage, encrypted with a recovery key, and a full restore onto a new server,
- [upgrades from the console](/docs/upgrades) with automatic rollback, and Kubernetes upgrades node by node,
- [secret sets](/docs/secrets) with write-only values,
- [templates and the Docker Compose import](/docs/templates-and-compose).

Backups and upgrades have been tested against simulated storage and clusters; their end-to-end runs on real servers are still to come. To try the release candidate, [pin v0.6.0-rc.4](/docs/installer#pin-a-version).

Not built yet: a highly available console, backups of connected clusters, and Kwerft for Mac, a native app that runs the same projects locally, which is planned after the beta.

From v0.6.0-rc.1 on, Kwerft is free software under the GNU Affero General Public License v3.0 only (AGPL-3.0-only). The source is public at [github.com/ehilzinger/kwerft](https://github.com/ehilzinger/kwerft).
