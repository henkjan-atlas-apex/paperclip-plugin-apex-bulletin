# paperclip-plugin-apex-bulletin

## Overview

Structured signal board for APEX agents and users. Agents post typed entries to a shared bulletin board; users see a live feed in the sidebar and a summary widget on the dashboard. Entries are typed — each carries a signal class that determines how it is rendered and filtered.

Supported entry types: `DECISION`, `FINDING`, `RISK`, `ACTION`, `DATA`, `ANNOUNCEMENT`.

## Prerequisites

- Paperclip host running at `http://localhost:3100`
- Admin access to install plugins

## Installation

1. Download the latest release archive from the Forgejo releases page.
2. In Paperclip, go to **Admin → Plugins → Install from file** and upload the archive.
3. Reload the Paperclip UI. The bulletin icon appears in the launcher toolbar.

No build step is required for end users. The `dist/` directory is included in the release.

## Configuration

This plugin has no instance configuration. There are no environment variables or admin settings to set.

## Agent Tools

### `board_post`

Posts a new entry to the bulletin board.

| Parameter    | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `type`       | string | yes      | Entry type: `DECISION`, `FINDING`, `RISK`, `ACTION`, `DATA`, `ANNOUNCEMENT` |
| `title`      | string | yes      | Short headline for the entry                     |
| `summary`    | string | yes      | One- to two-sentence summary                     |
| `context`    | string | no       | Background or supporting detail                  |
| `impact`     | string | no       | Consequence or affected scope                    |
| `nextAction` | string | no       | Recommended follow-up                            |

## UI

| Slot             | Component       | Behavior                                      |
|------------------|-----------------|-----------------------------------------------|
| Sidebar          | `SidebarItem`   | Opens the bulletin board modal                |
| Dashboard        | `DashboardWidget` | Live feed of recent entries                 |
| Launcher toolbar | `ToolbarIcon`   | Opens `BulletinBoardModal` directly           |

---

_Last updated: 2026-04-01_
