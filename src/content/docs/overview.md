---
title: Overview and infrastructure map
description: What the Overview lists under Needs attention, and how to read the infrastructure map of a cluster's apps, jobs, volumes, domains, traffic rules and firewall.
group: Operate
order: 0
---

The **Overview** is the console's start page. It lists what needs your attention and, below it, draws a map of one cluster: what reaches your apps from the internet, what they talk to, and where everything runs.

<div class="note">The infrastructure map needs Kwerft v0.6.0, which is in release candidates (from rc.2). The default install command installs v0.4.0; to try it, <a href="/docs/installer#pin-a-version">pin v0.6.0-rc.9</a>.</div>

## Needs attention

**Needs attention** collects what you should act on: firing alerts, apps that are not running as they should, failed builds, scheduled jobs whose last run failed (including a run that ran out of memory), domains whose certificate is not ready, and new releases of Kwerft or Kubernetes when they are available. Each item links to the page that deals with it. Items that are drawn on the map also have **Show on map**, which opens their project on the map and selects them.

## The infrastructure map

The map shows one cluster at a time; with more than one cluster, pick it in the cluster menu. It has two lenses over the same objects:

- **Traffic** reads from left to right: the internet, the server firewall, the gateway, your domains, the apps grouped by project, their volumes, and on the right what they reach on the internet. Traffic rules and the apps' allow lists are arrows. Their flow speed follows the live counts from Hubble, and dropped connections are drawn in red.
- **Placement** shows your servers with what runs on each: the apps' pods, the last runs of jobs, and the volumes.

Switching lenses moves each item from one layout to the other, so you can follow an app from where its traffic comes from to the server it runs on.

### Finding your way

- **Hover** over an item to highlight what it touches; **click** it to keep that focus and open the inspector beside the map. The inspector lists the item's inbound and outbound rules with their counts, and links to the pages that change them, such as the app, the traffic rule or the firewall.
- Pick one project in the project menu (**All projects** by default), or open a collapsed project with **Expand project**. Large clusters open with every project collapsed.
- **Show** turns layers on and off: jobs, volumes, domains, traffic rules and the firewall.
- **Only problems** keeps what is failing or dropping traffic.
- Drag the background to pan. **Zoom in**, **Zoom out** and **Fit to view** are next to the map; Ctrl or ⌘ with the scroll wheel zooms too.

### What you see

The map shows what you may see elsewhere in the console: the projects you have access to, and pods read as you. The servers and the firewall are on the map for owners and admins only. Volume fill and server usage come from the cluster's metrics, when they answer.
