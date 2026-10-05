---
title: Security model
description: How Kwerft protects the console, acts on Kubernetes as each user, isolates projects, stores secrets, encrypts backups, runs upgrades and records shells, for anyone evaluating it.
group: Reference
order: 3
---

This page summarizes Kwerft's security model for people evaluating it: what protects the first setup, how the console reaches Kubernetes, how projects are isolated, where secrets live, how backups are encrypted, and what is still open. Kwerft is pre-beta; the [known gaps](#known-gaps) are listed at the end.

## First setup

- There are no default passwords. After the install, the console is unusable until someone presents the **setup token** that the installer wrote to `/etc/kwerft/setup-token` on the server (root only, mode 0600). Presenting it proves control of the machine.
- The token is single-use, valid for 24 hours and only until the owner account exists. The cluster only ever holds its SHA-256 hash; the token itself never leaves the server's disk. Attempts are rate-limited.
- The Kubernetes API listens on the private network only. The host firewall lets in SSH, HTTP, HTTPS and WireGuard from the internet, nothing else.

## Identity and sign-in

- Passwords are hashed with argon2id and must be at least 12 characters.
- Second factors: passkeys (also for passwordless sign-in), authenticator apps (TOTP) and single-use recovery codes, which exist only while a passkey or authenticator app does. Adding or removing a factor asks for the password again.
- An owner can **require two-factor sign-in**. Members without a factor are then held to the enrolment pages after their password; nobody is locked out, and nobody can remove their last factor.
- Single sign-on uses OpenID Connect with the code flow, PKCE, state and nonce. Accounts are matched by verified email once, then by the provider's subject. Only members and invited people sign in, unless an owner or admin enables auto-join for allowed email domains. A member's own second factor is still asked for after the provider.
- Sessions are `__Host-` cookies, HttpOnly, ending after 7 days idle or 30 days at most. Every write must come from the console's own origin. Passwords, second factors, setup tokens and invites are rate-limited.
- Client addresses (for rate limits, the audit log and the firewall's lock-out check) are taken from the `X-Real-Ip` header only when the connection comes from a node, where the ingress runs; otherwise from the connection itself.

## Acting as the user: impersonation

The console never uses its own permissions for what a user does. Every write, and every read of a single object, goes to Kubernetes **as that user**: user `kwerft:<email>` in the group `kwerft:role:<role>`. Kubernetes RBAC is the final gate, so a bug in the console cannot give a user more than their role allows.

- The console's service account may impersonate only these users and groups, never `system:masters`.
- List views and monitoring (projects, apps, jobs, volumes, domains, metrics, log search, alerts, recordings) read from a cache, confined in the console to the projects the user reaches.
- Kwerft's test suite runs against a real Kubernetes API server and proves that a developer in one project cannot read another project's pods, logs, secrets, metrics, alerts, builds or traffic, through Kubernetes or through any console list, search or stream, also with project-limited API tokens.

## Roles and projects

Owners and admins manage everything. Developers and viewers get, cluster-wide, only read access to cluster-level objects such as project names, Git connections, alert rules and channels. Everything inside a project comes from role bindings that Kwerft writes into that project's namespace: for every member when the project is open to the team, or only for the listed members when it is limited to them. Role changes apply at once, also to open shells and log streams; removing a member ends their sessions. See [Access](/docs/access#roles) for the matrix.

## API tokens and kubectl

- API tokens (`kwft_…`) are 256-bit, shown once and stored as SHA-256 hashes. Each has a role cap (never above the user's current role), an optional project restriction and an expiry (90 days by default, a year at most). They cannot manage accounts, tokens, members or sign-in settings, and cannot open shells. Failed token attempts block the client address after 20 failures in 15 minutes.
- Downloaded kubeconfigs point at the console's proxy `/k8s/`, which impersonates the token's user. It refuses Secrets, exec, attach, port-forward, proxying, protocol upgrades and `--as`, and audits every write.

## Network defaults

- Each project is a namespace with a Pod Security level (`baseline` by default) and, by default, a default-deny Cilium policy: other projects cannot reach it.
- Each app accepts traffic only from the ingress for its public hostnames, the platform, and the apps it names. Outbound internet access is HTTPS-only by default.
- Traffic between nodes is encrypted with WireGuard.
- Plain HTTP only answers with a redirect to HTTPS (and Let's Encrypt's HTTP-01 challenges).
- Internal services without authentication of their own are fenced in by network policy: the log store accepts only its collector and the console, Hubble's flow relay only the console and the nodes, the build registry only build pods, the console and the nodes.
- The host firewall is a separate nftables table that protects HTTP(S), SSH from the private network and the cluster's own traffic from being closed in the console. Changes that remove access roll back after 60 seconds unless confirmed, even with the console down. See [Network](/docs/network#server-firewall).

## Secrets at rest

- k3s runs with secrets encryption on: Kubernetes Secrets are encrypted in etcd.
- Authenticator-app secrets in the console's database are encrypted with AES-GCM under a data key kept in the Secret `kwerft-data-key`. Owners rotate it under **Settings › Data key** with their password; Kwerft then re-encrypts everything and retires the old key. A Cluster [backup](/docs/backups) (v0.6.0) holds the key together with the database; without backups, back them up together yourself.
- Credentials Kwerft stores for you (the Hetzner DNS and Cloud API tokens, Git connection credentials, notification channel secrets, the single sign-on client secret, and from v0.6.0 the Object Storage keys) are write-only: owners and admins can replace them, nobody can read them back through the console, and no role reads Kubernetes Secrets through it.

## Secret sets

**v0.6.0.** Apps' secrets live in [secret sets](/docs/secrets), Kubernetes Secrets in the project's namespace that Kwerft manages:

- Values are write-only. Developers may write the Secrets of their projects' sets (Kubernetes RBAC limited to exactly those Secrets by name) but never read them. Viewers see key names only.
- The console never receives a value when it writes one: values are written through an endpoint that answers with metadata only. No API response carries a value, except **Reveal**.
- **Reveal** is for owners and admins, after their password or an authenticator code, never with an API token, and every reveal is audited. Copying a set into another project is for owners and admins too, and audited.
- The audit log names the set and key that changed, never values. Kwerft's test suite checks that no endpoint returns a value to any role and that one project's sets and key names are refused to members of another.

## Backups

**v0.6.0.** [Backups](/docs/backups) go to an S3 bucket you choose, and everything in it is encrypted with a recovery key that Kwerft shows once and does not keep in the backups:

- Volume data is encrypted by Kopia before it leaves the server.
- Every other object (apps, settings, secret values, the data key, tokens, the console's database copy) is encrypted by the storage with a key derived from the recovery key (SSE-C, AES-256). Kwerft refuses a store that does not encrypt with it. k3s's etcd snapshots in the bucket are encrypted the same way.
- This protects against leaked bucket keys, a bucket made public, and a second console pointed at the same prefix. It does not protect against the storage provider itself, which receives the key with each request over TLS and is trusted not to keep it.
- Object names and sizes are not encrypted: backup names and project names are visible in the bucket.
- The recovery key itself is excluded from the backups it unlocks. Keep it outside the server; without it, nobody can read the backups.

## Upgrades

**v0.6.0.** [Upgrades](/docs/upgrades) are started by owners only, after their password or an authenticator code; turning on AutoPatch asks for it too. An upgrade runs the release's own `install.sh` on the server as root, through a runner that the controller creates from the running console image, pinned by digest. The script is checked against the release's published SHA-256 checksums before it runs. Release checks are a plain download from the public install repository with nothing about the install in the request, and the policy **Off** makes none.

## Builds

Git builds run as rootless BuildKit jobs in their own namespace, the only one with relaxed Pod Security (rootless BuildKit needs it), under a resource quota. Build pods may reach the internet and the registry, but no private addresses, the cloud metadata service or anything else in the cluster. Pull requests from forks are never built. Apps run their built image pinned by digest.

## Shells and the audit log

- Shells need the developer role or higher, and only reach containers in project namespaces, never the platform's. Each shell needs a valid session and the console's own origin, closes after 15 minutes idle and 1 hour at most, and a user can have three at once.
- Every shell is recorded as an asciicast (terminal output only: keystrokes are not recorded, since unechoed input is mostly passwords). Recordings are stored with mode 0600, kept 90 days, and only owners and admins can play or download them; each playback is audited.
- The audit log records sign-ins, membership and role changes, every change to apps and jobs, token use and refusals, and shell sessions, with the client address. It is append-only from the console.

## Remote clusters and joining nodes

- Remote clusters run an agent that dials out to the console over TLS, verifying the console's certificate, and authenticates with a per-cluster token stored only as a hash. The agent carries requests only to its own cluster's API server, so remote API servers are never exposed. Rotating the token disconnects the old agent.
- Join commands hold a signed, expiring join token, not a Kubernetes credential. Worker nodes receive a short-lived k3s bootstrap token; control-plane join commands, which hand out the cluster's server token, are for owners only.

## Supply chain

Releases are built in CI as multi-arch images and a Helm chart on GHCR, with an SPDX SBOM next to the image; the published install script comes with SHA-256 checksums. Image signing (cosign) is prepared but opt-in per release. The installer verifies the Helm download's checksum and pins every component's version at the top of the script.

From v0.6.0-rc.1, the source is public at [github.com/ehilzinger/kwerft](https://github.com/ehilzinger/kwerft) under the GNU Affero General Public License v3.0 only (AGPL-3.0-only). All dependencies are Apache-2.0 or MIT.

## Known gaps

Kwerft is pre-beta. These are known and not yet solved:

- **Secret sets and backups are new.** Both arrive with v0.6.0, which is in release candidates. On v0.4.0 and v0.5.0, app secrets have to be created as root on the server, and there are no backups: back up the data key and your volumes yourself.
- **Backups are not yet proven on real storage.** They have been tested against simulated S3 storage, not yet against Hetzner Object Storage, and the recovery key cannot be rotated yet. Connected clusters are not backed up.
- **Install scripts are checksummed, not signed.** The checksum protects an upgrade against a broken download, not against a compromised release repository. Signing is planned.
- **Plain environment variables** are stored in the App resource and readable by everyone with access to the project. Put sensitive values in secret sets.
- **The build registry has no authentication.** A build in one project could push images into another project's repository; running apps are protected by digest pinning. Per-project registry credentials are planned.
- **Some names are visible to every role:** project names, alert rule names and notification channel names.
- **The console runs as a single replica** and is not highly available yet.
- **A remote Hetzner Cloud cluster created from the console receives the console's Cloud API token**, since Hetzner tokens cannot be scoped. Use separate Hetzner projects for separate trust boundaries.
