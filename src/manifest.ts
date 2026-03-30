import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip-plugin-apex-bulletin",
  displayName: "APEX Bulletin Board",
  description:
    "Structured signal board for APEX agents. Post decisions, findings, risks, actions, and data. " +
    "Visible as a dashboard widget and toolbar modal.",
  version: "0.1.0",
  apiVersion: 1,
  author: "APEX / Glacid.one",
  categories: ["automation"],
  capabilities: [
    "plugin.state.read",
    "jobs.schedule",
    "plugin.state.write",
    "agent.tools.register",
    "activity.log.write",
    "ui.dashboardWidget.register",
    "ui.action.register",
  ],
  entrypoints: { worker: "./dist/worker.js", ui: "./dist/ui/index.js" },
  ui: {
    slots: [
      {
        id: "bulletin-dashboard",
        type: "dashboardWidget",
        displayName: "Bulletin Board",
        exportName: "DashboardWidget",
        order: 10,
      },
    ],
    launchers: [
      {
        id: "bulletin-toolbar",
        displayName: "Bulletin Board",
        placementZone: "toolbarButton",
        exportName: "ToolbarIcon",
        action: {
          type: "openModal",
          target: "BulletinBoardModal",
        },
        render: {
          environment: "hostOverlay",
          bounds: "wide",
        },
      },
    ],
  },
  tools: [
    {
      name: "board_post",
      displayName: "Post to Bulletin Board",
      description:
        "Post a structured entry to the APEX bulletin board. Call this after completing any task " +
        "that produces a significant decision, finding, risk, action, or data output. " +
        "The entry is also automatically ingested into persistent memory with the tag 'bulletin-board'.",
      parametersSchema: {
        type: "object",
        required: ["type", "title", "summary"],
        properties: {
          type: {
            type: "string",
            enum: ["DECISION", "FINDING", "RISK", "ACTION", "DATA"],
            description:
              "Entry type: DECISION=strategic choice made, FINDING=research/analysis result, " +
              "RISK=identified risk needing visibility, ACTION=committed next step, DATA=new asset or dataset produced.",
          },
          title: { type: "string", description: "Short title (max 120 chars)." },
          summary: { type: "string", description: "1-3 sentences summarising the entry." },
          context: { type: "string", description: "Optional. Issue or task reference (e.g. ATL-12)." },
          impact: { type: "string", description: "Optional. Who or what this affects." },
          nextAction: { type: "string", description: "Optional. What should happen next." },
          agentRole: {
            type: "string",
            description: "Optional. Your role (e.g. CMO, CEO). Defaults to the calling agent's role.",
          },
        },
      },
    },
    {
      name: "board_get",
      displayName: "Read Bulletin Board",
      description:
        "Retrieve recent entries from the APEX bulletin board. Use to get a quick overview of " +
        "recent decisions, findings, and actions before starting a task.",
      parametersSchema: {
        type: "object",
        required: [],
        properties: {
          limit: { type: "number", description: "Max entries to return (default 20, max 100)." },
          type: {
            type: "string",
            enum: ["DECISION", "FINDING", "RISK", "ACTION", "DATA"],
            description: "Optional. Filter by entry type.",
          },
        },
      },
    },
  ],
  jobs: [
    {
      jobKey: "weekly-digest",
      schedule: "0 9 * * 1",
      displayName: "Weekly Digest",
      description: "Posts a summary of the week's bulletin board entries to plugin activity log.",
    },
  ],
};

export default manifest;
