---
title: Monitoring
description: Metrics for nodes and apps, a log search across your projects, alerts and silences, alert rules, and notification channels for Slack, email, webhooks and ntfy.
group: Operate
order: 1
---

Monitoring comes with the install: VictoriaMetrics for metrics, VictoriaLogs (fed by Vector) for logs, and vmalert with Alertmanager for alerts, all in the `kwerft-observability` namespace. Kwerft brings them into the console under **Monitoring**, with five tabs: **Alerts**, **Metrics**, **Logs**, **Alert rules** and **Channels**.

Everything you see is confined to the projects you can reach. Node metrics, the platform's own namespaces and the query explorer are for owners and admins.

## Retention

| | Default | With `--lite` |
|---|---|---|
| Metrics | 30 days | 7 days |
| Logs | 14 days | 3 days |

## Metrics

**Monitoring › Metrics** shows, for a time range of 1 hour to 7 days:

- CPU and memory in use over time,
- **Top memory consumers** and **Top CPU consumers** among apps.

Owners and admins also see:

- each node's CPU, memory and disk use against its capacity, and the cluster's capacity in the charts,
- **Platform**: what Kwerft, Kubernetes, the ingress, monitoring and builds use, per namespace,
- **Explore**: a PromQL / MetricsQL query over every namespace and node. Kwerft's recording rules are a good start: `kwerft:container_cpu_usage_cores:rate5m`, `kwerft:container_memory_working_set_bytes`, `kwerft:http_requests:rate5m` and `kwerft:http_latency_p95_seconds:5m`.

Developers and viewers see the apps of their projects only; the console adds that filter to every query itself.

Each app also has a **Metrics** tab: CPU, memory against its limit, restarts, and, for apps with a public hostname, requests per second, 5xx errors and the 95th-percentile response time through the public URL.

## Log search

**Monitoring › Logs** searches the log history of every project you may read, including pods that are gone (crashed, or replaced by a rollout).

- Type words or a LogsQL filter, for example `timeout`, `"connection refused"` or `stream:stderr`, and press **Search**.
- Narrow to a project and an app, a level (**All**, **Warnings**, **Errors**) and a time range from 15 minutes to 14 days.
- **Live** follows new lines as they arrive.
- Owners and admins can switch on **Platform** to include `kube-system`, `kwerft-system`, build pods and the other platform namespaces.

The filter lives in the URL, so you can share a search with a colleague. JSON log lines are parsed: their `level` (or `lvl`, `severity`) drives the level filter.

An app's own **Logs › History** is the same search, fixed to that app. Logs of finished jobs and builds come from here once their pod is gone.

## Alerts

**Monitoring › Alerts** lists what is **Firing**, what is **Silenced** and what **Resolved** in the last 24 hours. The sidebar shows the number of firing alerts next to Monitoring, and the Overview page lists them under **Needs attention**.

Each alert names its rule and, where it applies, the project and app, with buttons to its **Logs** and the app.

To quiet an alert while you work on it, click **Silence 1 h** or **Silence 24 h** and say why (others see the comment). Channels stay quiet about it until the silence ends; if it still fires then, it notifies again. Owners and admins can silence any alert; developers silence alerts of their projects, not platform alerts.

## Alert rules

**Monitoring › Alert rules** lists what Kwerft watches. These default rules exist from the start:

| Rule | Fires when | Severity |
|---|---|---|
| crash-looping | A container keeps crashing and restarting | critical |
| restarts | More than 5 restarts within 15 minutes | warning |
| memory-high | Memory above 90 % of the app's limit for 10 minutes | warning |
| volume-filling-up | A volume more than 85 % used, or full within 7 days | warning |
| node-memory-pressure | A server with less than 10 % memory available for 10 minutes | critical |
| node-disk-pressure | A server with less than 10 % disk free for 5 minutes | critical |
| certificate-expiring | A certificate expires within 14 days | warning |
| schedule-failing | A scheduled job failed | warning |
| build-failing | An app's latest build failed | warning |

Default rules notify nobody until you add a channel and pick it in the rule. You can change them, or switch them off with the **On** switch. A deleted default rule comes back within a minute with its default settings.

To add your own, click **New rule**:

1. **Name**, shown on alerts and notifications. It cannot change later.
2. **Condition:** one of crash looping, restarts, memory high, CPU high, volume filling up, node memory low, node disk low, certificate expiring, schedule failing, build failing, HTTP errors (share of 5xx responses), slow responses (95th percentile), or a **Custom expression** in MetricsQL.
3. The condition's threshold, window and how long it must hold (**For**). Empty fields take the defaults shown.
4. **Applies to:** everything, or chosen projects and apps.
5. **Severity:** **Critical** (someone should look now), **Warning** (soon) or **Info** (good to know).
6. **Notify:** the channels to send it to. Without any, the alert only shows in the console.

Developers may create and change rules for their projects with the built-in conditions; custom expressions are for owners and admins. With a custom expression, each series it returns is one alert. Keep the `namespace` and `app` labels so the alert links to the app.

The crash-loop rule is tuned to be fast: in a test, a crash-looping app reached a phone 57 seconds after it was deployed.

## Channels

**Monitoring › Channels** is where alerts go. Owners and admins add them with **Add channel**; everyone else sees them. Secrets (webhook URLs, passwords, tokens) are stored in the cluster and never shown again.

| Type | What you enter |
|---|---|
| **Slack** | An **Incoming webhook URL** (Slack: create an app › Incoming Webhooks › Add New Webhook to Workspace) and optionally a **Channel** |
| **Email** | **To** (one or more addresses), **From**, **SMTP server** as host and port (STARTTLS required), optional **Username** and **Password** |
| **Webhook** | A **URL**; Kwerft POSTs Alertmanager's JSON to it for every notification |
| **ntfy** | A **Server** (`https://ntfy.sh` or your own), a **Topic**, and an optional **Access token** for a protected topic |

On ntfy.sh, anyone who knows a topic can read it: pick one that is hard to guess.

**Send test** delivers a test notification straight to the destination and shows the answer, so a wrong Slack URL or SMTP password shows up at once. A channel notifies only for the alert rules that name it. Deleting a channel stops those rules from notifying there; the alerts still show in the console.

Notifications for an app's alert link to that app's Logs tab.

## Remote clusters

<div class="note">Remote clusters need Kwerft v0.5.0, which is in release candidates.</div>

Each connected cluster runs its own metrics, logs and alerting. The console queries them through the cluster's agent, with the same project confinement. Alerts show the cluster they come from, and the log search and metrics have a cluster picker. Notification channels are defined once, in the console, and copied to every connected cluster.
