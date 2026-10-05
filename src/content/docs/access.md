---
title: Access
description: Invite members, choose roles and project access, set up passkeys and two-factor sign-in, single sign-on, API tokens and kubeconfigs, and review shell recordings and the audit log.
group: Operate
order: 3
---

Kwerft is for one team. Each person has a console account with one of four roles, can be limited to some projects, and signs in with a password, a passkey or single sign-on. Everything they change goes to Kubernetes as them, so roles are enforced by Kubernetes RBAC and the audit log shows who did what.

Members, roles, the audit log and shell recordings are under **Access**. Your own sign-in settings and tokens are on your account page (click your name at the bottom of the sidebar).

## Roles

| Role | In short |
|---|---|
| Owner | Everything, including managing owners |
| Admin | Everything except managing owners |
| Developer | Deploy and run apps and jobs, open shells |
| Viewer | Read only |

The **Roles** tab shows the full matrix, which Kwerft tests against its Kubernetes roles:

| Permission | Owner | Admin | Developer | Viewer |
|---|---|---|---|---|
| View apps, jobs, pods and logs of the projects they reach | Yes | Yes | Yes | Yes |
| Deploy, change, scale, restart and delete apps | Yes | Yes | Yes | — |
| Run jobs, edit schedules and volumes | Yes | Yes | Yes | — |
| Build apps from Git and cancel builds | Yes | Yes | Yes | — |
| Open a shell in a container (recorded) | Yes | Yes | Yes | — |
| Edit traffic rules | Yes | Yes | Within their projects | — |
| Create secret sets and set, generate or remove their values (v0.6.0) | Yes | Yes | Within their projects; values cannot be read back | — |
| Reveal a secret value, after their password (v0.6.0, audited) | Yes | Yes | — | — |
| Copy a secret set into another project (v0.6.0) | Yes | Yes | — | — |
| Create and delete projects | Yes | Yes | — | — |
| Limit a project to its members and manage them | Yes | Yes | — | — |
| Manage Git connections and their credentials | Yes | Yes | — | — |
| Create and change alert rules | Yes | Yes | Built-in conditions only | — |
| Manage notification channels | Yes | Yes | — | — |
| Configure backups, back up and restore projects (v0.6.0) | Yes | Yes | — | — |
| Upgrade Kwerft and Kubernetes and change the update policy (v0.6.0) | Yes | — | — | — |
| See available updates and the upgrade history (v0.6.0) | Yes | Yes | — | — |
| Silence alerts | Yes | Yes | Alerts of projects, not platform alerts | — |
| Read Kubernetes Secrets | — | — | — | — |
| Invite members, change roles, remove members, reset second factors | Yes | Not owners | — | — |
| Require two-factor sign-in for everyone | Yes | — | — | — |
| Read the audit log and shell recordings | Yes | Yes | — | — |

Settings, the server firewall, clusters and nodes are for owners and admins. No role reads Secrets through the console; from v0.6.0, owners and admins can reveal a single secret value after their password, and each reveal is audited. See [Secrets](/docs/secrets).

## Members and invites

Kwerft does not send email yet: you invite someone with a link.

1. Open **Access › Members** and click **Invite member**.
2. Enter their **Email** and choose a **Role**.
3. Copy the invite link and pass it on. It is shown only this once, works once, and expires after 7 days.

They open the link, choose a name and a password of at least 12 characters, and are signed in. Open invites are listed under **Pending invites**, where **New link** replaces a lost link (the old one stops working) and **Revoke** cancels it.

To change someone's role or remove them, click **Edit** next to them:

- A role change applies at once, also in Kubernetes and to shells and log streams they have open.
- **Reset second factors** removes their passkeys, authenticator app and recovery codes and signs them out, for a lost phone or key. They then sign in with their password and set up a factor again.
- **Remove from team** deletes the account and signs them out everywhere at once. The audit log keeps what they did.

Admins manage everyone except owners, and the last owner cannot be removed or demoted.

## Project access

By default every member reaches every project with their console role. To limit a project to some people:

1. Open **Apps**, select the project in the project filter, and click **Access to &lt;project&gt;**.
2. Click **Limit to members…** and choose, for each developer and viewer, **Developer**, **Viewer** or **No access** in this project.

From then on, only the listed members (and all owners and admins) reach the project, each with the role given there. In the same dialog you add and remove members or change their role, or **Open to the whole team** again. Changes apply within seconds, also in Kubernetes, and are recorded in the audit log. A project limited to members shows a shield in the project filter.

## Passkeys and two-factor sign-in

Every member sets up their own second factors on their account page, under **Two-factor sign-in**:

- **Passkeys:** **Add passkey** to sign in with a fingerprint, face, device PIN or security key. A passkey also works without a password.
- **Authenticator app:** **Set up**, scan the QR code with an app such as 1Password, Bitwarden, Aegis or Google Authenticator, and enter the 6-digit code.
- **Recovery codes:** once you have a passkey or authenticator app, Kwerft shows recovery codes once. Each signs you in once if your passkeys and phone are out of reach. **Generate new codes** replaces all old ones.

Adding or removing a factor asks for your password again. A passkey works only on the hostname it was made on; see [moving the console](/docs/domains-and-tls#move-the-console).

On the account page you can also change your password (which signs you out everywhere else) and see **Signed-in sessions**, where you can sign out any browser you don't recognize. Sessions end after 7 days without use, and after 30 days at most.

### Require two-factor sign-in

An owner can make a second factor mandatory: **Access › Members › Two-factor sign-in › Require two-factor sign-in**. The owner needs a factor of their own first. Members without one are not locked out: after their password, the console takes them to their account page to add a passkey or authenticator app before anything else opens. While it is required, nobody can remove their last factor. **Make it optional** turns it off.

## Single sign-on

Owners and admins connect an OpenID Connect provider under **Settings › Single sign-on**:

1. At the provider, create an OAuth client (Google: a web application; Microsoft Entra: a single-tenant app registration with a client secret; Keycloak: a confidential client with the standard flow). Use the **Redirect URL** that Settings shows: `https://<console>/api/v1/sso/callback`.
2. Tick **Offer single sign-on on the sign-in page** and choose the **Provider**: Google, Microsoft Entra ID (with its **Directory (tenant) ID**), Keycloak or **Other OpenID Connect provider** (with its **Issuer URL**; for Keycloak, the realm's URL).
3. Enter the **Client ID** and **Client secret**, an optional **Button label** and the **Allowed email domains**.
4. Optionally tick **Let new people join on their first sign-in**, with a **Role for people who join** (Developer or Viewer). This needs allowed domains. Without it, only members and people with an open invite can sign in.

Kwerft links a provider account to a member by verified email address the first time, then by the provider's own ID. Passwords and passkeys keep working next to single sign-on, and a member's own passkey or authenticator app is still asked for after the provider. GitHub is not an OpenID Connect provider for sign-in; put Keycloak or Dex in front of it.

Accounts created by single sign-on have no password. They can set one within 10 minutes of signing in with the provider, and unlink the provider under **Single sign-on** on the account page.

## API tokens

Scripts and CI use API tokens. On your account page, under **API tokens**, click **Create token**:

- a **Name**,
- a **Role**: yours or lower,
- **Expires after (days)**: 90 by default, at most 365,
- **Projects**: all, or some. A token limited to projects can be developer or viewer only.

The token starts with `kwft_` and is shown once. Send it as a bearer token:

```bash
curl -H "Authorization: Bearer kwft_…" https://ops.example.com/api/v1/session
```

A token never has more rights than you have now: if your role drops, so does the token's. Tokens cannot manage accounts, tokens, members or sign-in settings, and cannot open shells. **Revoke** ends one at once.

## Kubeconfig and kubectl

**Download kubeconfig**, next to Create token, gives you a kubeconfig with a token of its own, with the role, expiry and projects you pick. It points at the console's proxy, `https://<console>/k8s/`, not at the Kubernetes API, which stays private:

```bash
export KUBECONFIG=~/Downloads/<file>.yaml
kubectl get pods -n shop
kubectl get apps.kwerft.dev -n shop -o yaml
```

The proxy acts as you, like the console does. It refuses Secrets, `kubectl exec`, `attach`, `port-forward` and `proxy`, and `--as`. Open shells in the console, where they are recorded. Writes through the proxy appear in the audit log.

## Shell recordings

Every shell opened from an app's replicas or a running job is recorded: what the terminal showed, not the keystrokes (unechoed input is mostly passwords). Owners and admins find them under **Access › Recordings**, filtered by person and project:

- **Play** replays a session in the browser.
- **Download** saves it as an asciicast v2 file that plays with asciinema.

Recordings can contain secrets that a shell displayed, so every playback and download is written to the audit log. Recordings are kept 90 days, up to 64 MiB per session.

## Audit log

**Access › Audit log** (owners and admins) records sign-ins, membership changes, every change to apps and jobs, and shell sessions, with time (UTC), who, the action, the target and the address it came from. Filter by person or by action. Entries cannot be edited or deleted from the console.
