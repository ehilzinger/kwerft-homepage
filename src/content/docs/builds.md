---
title: Builds from Git
description: Connect a Git host, deploy a repository built from its Dockerfile or with Railpack, deploy on every push, and follow builds and commit checks.
group: Run apps
order: 2
---

Instead of a ready-made image, an app can come from a Git repository. Kwerft clones it, builds an image inside the cluster with rootless BuildKit, stores it in its own registry and rolls it out as a new revision. With a webhook, every push to the branch deploys, and the commit gets a check that links to the build.

## Git connections

Public repositories build without any setup. For private repositories, webhooks that Kwerft registers itself, and commit checks, an owner or admin adds a Git connection under **Settings › Git connections** with **Add connection**:

1. **Git host:** **GitHub**, **GitLab**, **Gitea / Forgejo** or **Other Git host**.
2. **Name:** apps refer to the connection by it, for example `github-acme`. It cannot change later.
3. **Address:** the host's URL, such as `https://github.com` or `https://git.example.com`.
4. **Account or organisation** (optional) limits the connection to repositories of that owner or group.
5. **Authentication**, see below.
6. **Projects:** **All projects**, or only the projects whose apps may build with it.

Everyone can see connections; their credentials are write-only and never shown again.

### Authentication

| Authentication | Clones | Registers the push webhook | Commit status |
|---|---|---|---|
| **GitHub App** (GitHub only) | Yes | Yes | Yes |
| **Access token** | Over HTTPS | Yes | Yes |
| **SSH deploy key** | Over SSH | No, add it yourself | No |
| **No credentials** | Public repositories only | No, add it yourself | No |

What each needs:

- **Access token on GitHub:** a fine-grained token with Contents (read), Commit statuses and Webhooks (read & write) on the repositories.
- **Access token on GitLab:** a project, group or personal access token with the `api` scope. `read_repository` is enough if you do without webhooks and checks.
- **Access token on another host:** read access to the repository, write access to webhooks and commit statuses.
- **GitHub App:** the **App ID** (on the app's settings page, under About), the **Installation ID** (the number at the end of the installation's URL) and the **Private key** (`.pem`). The app needs Contents (read), Commit statuses (write) and Webhooks permissions.
- **SSH deploy key:** create one with `ssh-keygen -t ed25519 -N "" -f kwerft`, add `kwerft.pub` as a read-only deploy key to the repository and paste the private key. **Known hosts** is optional (`ssh-keyscan git.example.com`); without it, Kwerft records the host key on first use.

### Webhooks

When a connection is added, Kwerft shows its webhook secret once: store it. The connection also shows its **Webhook URL**, `https://<console>/api/v1/hooks/git/<connection>`.

With a GitHub App or an access token, Kwerft registers the webhook on the repositories it builds. Otherwise, add it in each repository's webhook settings yourself: the URL, the secret, push events, and pull request events if you want checks on pull requests.

**Rotate secret** makes a new webhook secret. For webhooks you added by hand, enter the new secret in every repository; the old one stops working at once.

Deleting a connection makes Kwerft forget its credentials and remove the webhooks it registered. Running apps keep running, but apps that use it fail their next build until they get another connection.

## Deploy a repository

1. Open **Apps › Deploy app** and choose **Git repository**.
2. Enter the **Repository**, as HTTPS (`github.com/acme/api`) or SSH (`git@github.com:acme/api.git`), and click **Check**. Kwerft says whether it can reach the repository, shows the last commit and whether the Dockerfile is where you said.
3. Set the **Branch** (default `main`) and **Access**: **Public repository (no credentials)** or a Git connection. Kwerft suggests the connection that matches the repository's host.
4. Choose **Build with**:
   - **Dockerfile:** builds the repository's Dockerfile. **Dockerfile** is its path relative to the directory.
   - **Railpack:** detects the language (Node, Go, Python and others) and builds without a Dockerfile.
5. **Directory** is the build context inside the repository, for monorepos (default `/`).
6. **On push:** on, every push to the branch builds and deploys, and pull requests get a check build only. Off, builds run only when someone presses **Build now**.
7. Continue with runtime and networking as for an image app (see [Apps](/docs/apps)), then deploy.

The first build of the branch's head starts right away; the app starts once it succeeds. To change the repository, branch or builder later, use the app's **Settings › Source**.

## The Builds tab

A Git app's **Builds** tab lists its builds, newest first, with commit, author, trigger, duration and status:

| Status | Meaning |
|---|---|
| Queued | Waiting for a builder |
| Building | Running |
| Deployed | Its image is what the app runs now |
| Superseded | Deployed before; a newer build replaced it |
| Built / Passed | Succeeded but not deployed (for example a pull request check) |
| Failed / Cancelled | Did not produce an image |

Click a build to see its commit, branch, builder, image digest and its **live log**, which you can download. **Build now** builds the head of the branch; **Cancel** stops a running build without touching what the app runs.

A rollback of a Git app pins it to that revision's image: builds keep running, but none is deployed until you click **Follow builds again**.

## Pull requests and commit checks

With a GitHub App or access token, Kwerft reports each build to the Git host as a commit status named `kwerft/<project>/<app>`: pending, then success or failure, linking to the build in the console.

Pull requests from the same repository get one check build per app that uses the repository. They are never deployed, and they run one at a time. Pull requests from forks are never built.

## How builds run

- Builds run as Kubernetes jobs in the `kwerft-builds` namespace with rootless BuildKit. That namespace is the only one allowed to run with relaxed Pod Security, and its pods may reach the internet (to clone and pull base images) and Kwerft's registry, but no private addresses and nothing else in the cluster. Git hosts on a private network are therefore out of reach.
- One build runs at a time by default, so builds do not starve apps on small servers. A build that runs longer than 30 minutes is stopped.
- Images go to the in-cluster registry (zot) as `registry.kwerft.internal:5000/<project>/<app>`, with the layer cache next to them, so later builds reuse what did not change. Apps run their image pinned by digest.
- Each build needs 1–2 GB of memory while it runs. On a busy cluster, a build pool keeps builds on servers of their own that start when a build is queued and stop when idle. See [Clusters & nodes](/docs/clusters-and-nodes#build-pools).

Kwerft removes old builds that no revision runs. The registry keeps, per app, the newest 20 images and any image pulled in the last 90 days.

## Who may do what

Developers (and owners and admins) start and cancel builds and deploy Git apps in their projects. Only owners and admins manage Git connections. Viewers see builds and their logs.
