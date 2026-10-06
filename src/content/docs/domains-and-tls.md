---
title: Domains & TLS
description: The console's hostname and how to move it, an apps domain for your apps, HTTP-01 or wildcard certificates through Hetzner DNS, managed DNS records, and the sslip.io fallback.
group: Run apps
order: 6
---

Every hostname Kwerft serves gets a Let's Encrypt certificate, and plain HTTP redirects to HTTPS. This page explains the console's own hostname, the apps domain that gives apps names without new DNS records, the two ways certificates are issued, and the DNS records Kwerft can keep for you. Owners and admins change these under **Settings**; everyone else sees them read-only.

## The console's hostname

You choose it when you install, with `--domain ops.example.com`. Point an A record for it at the server; the certificate is issued once the name resolves there. Re-running the installer without `--domain` keeps the current hostname, whatever you chose in Settings since.

### Without a domain: sslip.io

If you install without `--domain`, the console gets a temporary hostname `<public-ip>.sslip.io`. The public sslip.io service resolves it to your server, so the console gets a real certificate with no DNS setup. Settings marks it as a **Temporary name**: it is for trying Kwerft, not for production. Move to your own hostname as described next.

### Move the console

1. Create an A record for the new hostname pointing at the server (or let Kwerft create it, see [Managed DNS records](#managed-dns-records)).
2. Open **Settings › Console domain**, enter the **New console hostname** and click **Check DNS**.
3. Click **Move the console…** and read the dialog, then type the new hostname to confirm.

The console first gets a listener and a certificate for the new name and moves only once that certificate is issued; until then it stays where it is, and **Cancel the move** undoes it. After the move, the old name redirects to the new one for a day.

Two things do not move with it:

- **Sessions.** Everyone signs in again on the new name.
- **Passkeys.** A passkey only works on the hostname it was created on. Members sign in with their password and an authenticator app or a recovery code, then add a passkey again. The dialog lists everyone with passkeys and how they will sign in; Kwerft refuses the move while someone would have no other way in.

Re-running the installer with a different `--domain` also moves the console; it switches once the new name's certificate is issued.

## The apps domain

An apps domain gives apps names under one base domain: with `apps.example.com`, an app called `invoices` gets `invoices.apps.example.com`, and the deploy wizard suggests that name. You set it under **Settings › Apps domain & certificates** as **Base domain for apps**.

Apps can always use other hostnames too; those need a DNS record each, pointing at the server.

## How certificates are issued

Under **How should certificates be issued?** you choose one of two methods for the apps domain.

### HTTP-01, one certificate per hostname

No DNS credentials needed. Each app hostname gets its own listener and certificate, which Let's Encrypt issues after checking the name over HTTP on port 80. Each hostname needs a DNS record pointing at the server; one wildcard record such as `*.apps.example.com` covers them all. **Check wildcard DNS** tells you whether it is in place.

Limits to know:

- The Gateway has room for 59 hostnames with listeners of their own.
- Let's Encrypt issues at most 50 certificates per week per registered domain (for example `example.com`), and 5 per week for the same hostname.

### DNS-01 via Hetzner DNS, wildcard certificate

One certificate for `*.apps.example.com` and one listener serve every app directly under the apps domain, without the 59-hostname limit and without waiting for a certificate per app. Let's Encrypt checks it through a DNS record, so Kwerft needs an API token for the zone:

1. In the Hetzner Console, open the project that holds your DNS zones, then **Security › API tokens**, and create a token with **Read & Write**.
2. Paste it as **Hetzner API token**. Kwerft checks that it can see the zone, stores it and never shows it again.

DNS zones now live in the Hetzner Cloud API; the old DNS Console API (dns.hetzner.com) was shut down in May 2026.

When you switch to DNS-01, apps under the domain move to the wildcard once its certificate is issued, usually within two minutes; until then they keep their own certificates. When you switch back, each app gets its own certificate again, and HTTPS answers with a default certificate until those are issued.

The wildcard covers names one level below the apps domain only: `invoices.apps.example.com`, not `eu.invoices.apps.example.com`.

## Managed DNS records

Tick **Let Kwerft create the DNS records** to have Kwerft keep these records in Hetzner DNS, with the same API token:

- A and AAAA records for the console's hostname,
- A and AAAA records for `*.<apps domain>`,

all pointing at the server, and updated when its address changes. One wildcard record covers every app, so deploying an app never writes DNS.

Kwerft labels the records it creates and changes only those. A name that already has records you made yourself is listed as a conflict and left alone. The **DNS records** card in Settings shows every record and its state. Turning the option off leaves the records as they are; Kwerft just stops updating them.

With managed records on, a console move into one of your Hetzner zones needs no manual record: Kwerft creates it.

## Watch certificates

**Network › Domains & TLS** lists every hostname: the console, the apps wildcard (if any) and each app's hostname, with what it routes to, its certificate state (**Valid**, **Issuing**, **Pending**, **Failed**), its expiry date and its listener. Expiry dates less than 14 days away are highlighted.

Certificates renew automatically about a month before they expire. The default alert rule **certificate-expiring** fires if one is not renewed in time.

When an app stops serving a hostname, its certificate is kept for seven days, so a hostname that comes back reuses it instead of spending Let's Encrypt quota.

## Set it all up at install time

For unattended installs, put the same choices in the installer's `--config` file:

```yaml
domain: ops.example.com
email: ops@example.com
appsDomain: apps.example.com
dns:
  solver: hetzner
  tokenFile: /root/dns.token
  records: true
```

`dns.records` defaults to `true` when `dns.solver` is set. See the [installer reference](/docs/installer#config-file).

## Test servers: Let's Encrypt staging

For servers you reinstall often, `--acme-server staging` takes certificates from Let's Encrypt's staging CA. Browsers do not trust them, but the rate limits are generous. It needs Kwerft v0.5.0, which is in release candidates ([pin v0.6.0-rc.4](/docs/installer#pin-a-version)). With the v0.5.0 candidates, give the flag on every run; from v0.6.0 the server remembers it.

## Remote clusters

<div class="note">Remote clusters need Kwerft v0.5.0, which is in release candidates. See <a href="/docs/clusters-and-nodes">Clusters &amp; nodes</a>.</div>

An app in a connected cluster can use a hostname one level below the console's apps domain, as it would locally. The console then keeps an A/AAAA record for that hostname pointing at the other cluster (with managed records on), and the cluster gets the certificate itself through HTTP-01. A new hostname answers a minute or two after its deploy. Deeper names under the apps domain, such as `a.b.apps.example.com`, get no record: the console reports them and suggests `a-b.apps.example.com`, or you create the record by hand.

With more than one cluster, Settings has a cluster picker: each cluster can have an apps domain of its own. Records for a cluster's own domain are yours to create; the cluster's page shows the addresses to point them at.
