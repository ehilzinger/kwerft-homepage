---
title: Jobs
description: Run one-off tasks from an app or a schedule, put jobs on a cron schedule, and follow every run with its exit code and logs.
group: Run apps
order: 4
---

Jobs are workloads that run to completion: a database migration, a nightly backup, an hourly import. Kwerft has two kinds. A **task** is one run. A **schedule** starts a task on a cron schedule. Every scheduled run is a task too, so scheduled and manual runs look the same in the console.

Jobs have the same shape as apps: an image (or an app's image and settings), a command, environment variables, a size, outbound access and shared volumes. They have no ports, replicas or health checks. They run under the project's quota and network isolation, at a lower priority than apps, so under memory pressure a job gives way before a service.

You need the developer role (or owner or admin) in the project to run jobs and edit schedules.

## Run a task now

From an app:

1. Open the app and click **Run as job**.
2. Optionally add **Override env** rows, such as `FORCE=1` or `DRY_RUN=1`. They are added on top of the app's own variables.
3. Optionally set a **Timeout** (`30m`, `2h`), **Retries** (0–10) and whether to restart the app once the task succeeds.
4. Start it. Kwerft opens the run.

The task uses the app's current image, command, environment, size, outbound access and shared volumes, and the same network identity, so whatever may connect to the app may also connect to its tasks.

From the **Jobs** page, **Run task** asks you to choose a schedule or an app first. **Run now** on a schedule starts one run of it, with optional environment overrides; it counts as one of the schedule's runs for concurrency and history.

Every run you start is recorded in the audit log under your name.

### A one-off task with its own image

The console starts one-off tasks from an app or a schedule. For a task with an image of its own, apply a `Task` resource with kubectl (see [Access › kubectl](/docs/access#kubeconfig-and-kubectl)):

```yaml
apiVersion: kwerft.dev/v1alpha1
kind: Task
metadata:
  name: reindex-once
  namespace: shop
spec:
  source:
    image:
      ref: ghcr.io/acme/ops:1.4.0
  command: ["bin/reindex", "--full"]
  timeout: 30m
```

It then shows up on the Jobs page like any other run.

## Create a schedule

1. Open **Jobs** and click **New schedule**.
2. Under **What runs**, enter a **Name** (runs are named after it) and the **Project**, and choose the **Source**:
   - **From an app:** runs that app's image with its command, environment, size, outbound access and shared volumes, read when each run starts.
   - **Container image:** an image of its own, with an optional **Registry credential**.
3. **Command** is optional; empty uses the app's or the image's. Write it like in a shell: `bin/reindex --full`. For pipes, `&&` or `$VARIABLES`, use `sh -c '…'`.
4. Add **Env** variables (added to the app's when the source is an app) and **Shared volumes**.
5. Under **When**, choose **Hourly** (at a minute), **Daily at…**, **Weekly** (a day and a time) or **Custom** with a cron expression: `minute hour day-of-month month day-of-week`, or `@hourly`, `@daily`, `@weekly`, `@every 2h`. The form shows the next runs.
6. **Time zone** takes an IANA name such as `Europe/Berlin`; daylight saving is handled. Empty means the server's time (UTC).
7. **If a run is still going when the next is due:**
   - **Wait for it** (the default): the due run starts once the earlier one finishes, within an hour; otherwise it is skipped.
   - **Stop it:** the earlier run is cancelled and the new one starts.
   - **Run both:** runs overlap; make sure the job tolerates that.
8. Under **Limits & history**, set a **Timeout** for each run (all retries included), **Retries**, **Time to stop** (see below), how many succeeded and failed runs to keep (3 each by default), the **Size** and **Outbound access**.
9. Under **On success**, pick apps in the same project to restart once a run succeeds (see below).

The page also shows the schedule as YAML (**Schedule as YAML**).

If the server was down when a run was due, only the latest missed run starts, and only within an hour of when it was due.

### Time to stop

**Time to stop** (v0.6.0) is how many seconds a run gets to finish after it is told to stop (cancelled, its timeout reached, or its server drained) before it is killed: the run receives SIGTERM, then SIGKILL once the time is up. The default is 30 seconds, the range 1 to 3600. Give a job that flushes or checkpoints its work on SIGTERM the time it needs. A run's page shows the value.

One-off tasks started with **Run as job** use the default; a `Task` resource takes `stopSeconds`.

## Restart an app when a job succeeds

A common pattern is a job that replaces a file that a server has to reopen, such as a database or an index on a shared volume. Select the server under **On success** (or tick the restart option when you run a task from an app). Once the run succeeds, Kwerft rolls out the app, one replica at a time. The job itself needs no permissions for this: Kwerft's controller does the restart.

## Follow runs

The **Jobs** page lists:

- **Schedules:** image or source app, next run, last run, what it restarts on success, and an **Active** switch. Switch it off to suspend the schedule: no new runs start until you switch it back on.
- **Recent runs:** who or what started each one, when, how long it took, its exit code and status. From v0.6.0-rc.8, a run that was killed for using more memory than its size allows says **out of memory** with the limit, for example "out of memory (limit 256Mi)", instead of exit code 137: give the task a larger size.

Open a run to see its status, exit code, duration, image, command, size, timeout, retries, time to stop, environment and overrides, and its **Logs**, live while it runs and afterwards. A running task has a **Shell** button, like an app's replicas. **Cancel run** stops it and keeps the record; **Run again** starts the same task anew; **Delete** removes the run and its logs.

## How long runs are kept

- Runs of a schedule: the newest 3 succeeded and 3 failed by default (set per schedule, up to 100 each).
- One-off tasks: 7 days after they finish.

Logs of finished runs stay readable after their pod is gone, from the log store (14 days by default). Deleting a schedule stops new runs and removes its runs, including any still going, with their logs.

## Alerts on failing schedules

The default alert rule **schedule-failing** fires when a scheduled job fails. You can also make it fire when a schedule has not succeeded for a while. See [Monitoring › Alert rules](/docs/monitoring#alert-rules).
