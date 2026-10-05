---
title: Secrets
description: Keep passwords and API keys in write-only secret sets, let Kwerft generate and derive values, use them as environment variables or files, and reveal or copy them as an owner or admin.
group: Run apps
order: 5
---

Passwords, API keys and tokens belong in a **secret set**, not in plain environment variables. A secret set is a named group of keys in a project, such as `payments` with `STRIPE_KEY` and `WEBHOOK_SECRET`. Apps, jobs and schedules of the project use its values as environment variables or files. Values are write-only: once saved, nobody reads them back in the console.

<div class="note">Secret sets need Kwerft v0.6.0, which is in release candidates. The default install command installs v0.4.0; to try them, <a href="/docs/installer#pin-a-version">pin v0.6.0-rc.1</a>. In earlier versions, see <a href="/docs/apps#secrets">Apps › Secrets</a> for the way around.</div>

## Who can do what

- **Developers** (and owners and admins) create sets in their projects, and set, replace, generate and remove values. They never see a value after saving it.
- **Viewers** see the sets and their key names, not the values.
- **Owners and admins** can also **Reveal** one value after their password, and **Copy** a set into another project. Both are recorded in the audit log. API tokens cannot reveal values.

## Create a secret set

1. Open **Secrets** in the sidebar and pick the project.
2. Click **New secret set**.
3. Enter a **Name** (apps reference keys as `<set>/<KEY>`, like `payments/STRIPE_KEY`) and an optional **Description**.
4. Optionally list keys under **Generate (optional)** and **Derived keys (optional)** (see below).
5. Click **Create set**, then add the values.

To add a value, enter the key's **NAME** and its value under **Add key** and click **Save**, or click **Generate** to let Kwerft make one. A value is never shown again: the field shows dots.

For each key, the set shows who changed it last and when. Per key:

- **Replace** sets a new value.
- **Generate** replaces the value with a new random one: 32 random bytes, base64url-encoded (43 characters).
- **Remove** deletes the key.
- **Reveal** (owners and admins) shows the value once, after your password or a current authenticator code.

The set's **Used by** column lists the apps, schedules and tasks that reference it. A key that something references but the set lacks is listed as **referenced, not set**, with a field to fill it in.

**Edit** changes the description and the generated and derived keys. **Delete** deletes the set and every value in it; type the set's name to confirm.

## Generated and derived keys

- **Generate (optional):** keys that Kwerft fills with 32 random bytes while they are missing, comma-separated, for example `PASSWORD`. An existing value is never replaced by this.
- **Derived keys (optional):** one per line, `KEY=template`, where `${KEY}` is another key of the set. For example:

```
DATABASE_URL=postgres://app:${PASSWORD}@postgres-main:5432/app
```

Kwerft writes the derived value once all its inputs exist and keeps it up to date when an input changes. Until then the set shows **Waiting for input**. Derived keys cannot be set by hand.

Together they let a set hold a database password that nobody ever typed, and the connection string that uses it. The [templates](/docs/templates-and-compose#templates) work this way.

## Use a secret as an environment variable

In the app's **Settings › Environment**, each variable has a **Source**:

- **Plain:** the value is stored in the App resource, readable by everyone with access to the project.
- **Secret · this app:** the value goes write-only into the app's own secret set, `<app>-env`. Kwerft creates that set when it is first needed and deletes it with the app.
- A key of a shared set, listed under **Set &lt;name&gt;**: the variable reads that key.

In the deploy wizard, **Secret variables (KEY=value, one per line)** go into the app's own set. Keys of shared sets are picked in the app's settings afterwards.

Changing a value rolls the app's replicas one at a time, without a new revision. Jobs read the value when their next run starts.

If an app references a set or key that does not exist yet, its new replicas wait: the app shows that it is waiting for secret values, instead of starting and crashing. Running replicas keep running.

Tasks and schedules that run from an app use the app's variables, secrets included. The schedule form has no **Source** yet: for a schedule with an image of its own, reference a key in its YAML with `valueFrom.secretKeyRef` (`name` is the set, `key` the key); the form keeps such variables when you save.

## Mount a secret as files

Some programs want a file: an SSH key, a certificate, a credentials file. Under **Shared volumes and secrets** (in the deploy wizard, an app's **Settings › Volumes**, or a schedule's form), click **Mount a secret as files**:

- the **path** to mount it at, such as `/etc/secret`,
- the **Secret name**: a secret set's name works,
- the file permission: **Readable by all (0444)** (the default) or **Owner only (0400)**, which some programs insist on for keys.

Each key becomes one file under the path, read-only. Until the secret exists, new replicas wait. When a value changes, the files are updated in place within a minute or so; the app is not restarted.

## Copy a set to another project

Owners and admins click **Copy to…**, choose the **Project** and optionally another **Name there**, and click **Copy set**. The copy gets the same keys and values and then lives on its own: changing one set does not change the other. Sets cannot be shared across projects, so project isolation holds.

## How values are protected

- Values are stored as Kubernetes Secrets in the project's namespace, which k3s encrypts at rest.
- The console never receives a value back when it writes one, and no role reads Secrets through the console or a downloaded kubeconfig. Revealing a value is the only way to see it, for owners and admins, after their password, audited.
- Developers can write the values of their projects' sets but never read them, also not through Kubernetes.
- Backups hold the values, encrypted with the [recovery key](/docs/backups#encryption-and-the-recovery-key).

## Limits

- A variable names one key. Taking every key of a set as variables at once (`envFrom`) is not supported yet.
- ConfigMaps cannot be mounted as files from the console yet.
- External secret stores (such as Vault or 1Password through the External Secrets Operator) are not supported.
- A private image's **Registry credential** is a docker-registry Secret, which secret sets cannot create yet: create it on the server, as described under [Apps › Secrets](/docs/apps#secrets).
