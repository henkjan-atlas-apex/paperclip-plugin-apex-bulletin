import {
  usePluginData,
  usePluginAction,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryType = "DECISION" | "FINDING" | "RISK" | "ACTION" | "DATA" | "ANNOUNCEMENT";

interface BoardEntry {
  id: string;
  type: EntryType;
  title: string;
  summary: string;
  context?: string;
  impact?: string;
  nextAction?: string;
  agentRole?: string;
  companyId: string;
  postedAt: string;
}

// ---------------------------------------------------------------------------
// Type colour mapping
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<EntryType, { bg: string; text: string }> = {
  ANNOUNCEMENT: { bg: "#fef3c7", text: "#92400e" }, // amber — visually prominent
  DECISION: { bg: "#dbeafe", text: "#1d4ed8" },
  FINDING: { bg: "#dcfce7", text: "#15803d" },
  RISK: { bg: "#fee2e2", text: "#b91c1c" },
  ACTION: { bg: "#ede9fe", text: "#6d28d9" },
  DATA: { bg: "#f1f5f9", text: "#475569" },
};

const ENTRY_TYPES: EntryType[] = ["ANNOUNCEMENT", "DECISION", "FINDING", "RISK", "ACTION", "DATA"];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: EntryType }) {
  const c = TYPE_COLORS[type];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 4,
        letterSpacing: "0.05em",
        flexShrink: 0,
        textTransform: "uppercase" as const,
      }}
    >
      {type}
    </span>
  );
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function EntryCard({ entry }: { entry: BoardEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: "10px 12px",
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: expanded ? 4 : 0,
        }}
      >
        <TypeBadge type={entry.type} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            flex: 1,
            color: "#1e293b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: expanded ? "normal" : ("nowrap" as const),
          }}
        >
          {entry.title}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
          {formatDate(entry.postedAt)}
        </span>
      </div>
      {expanded && (
        <div
          style={{
            fontSize: 12,
            color: "#475569",
            marginTop: 6,
            display: "grid",
            gap: 4,
          }}
        >
          <div>{entry.summary}</div>
          {entry.context && (
            <div>
              <strong>Context:</strong> {entry.context}
            </div>
          )}
          {entry.impact && (
            <div>
              <strong>Impact:</strong> {entry.impact}
            </div>
          )}
          {entry.nextAction && (
            <div>
              <strong>Next:</strong> {entry.nextAction}
            </div>
          )}
          {entry.agentRole && (
            <div style={{ color: "#94a3b8" }}>Posted by: {entry.agentRole}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostForm — create a new bulletin entry
// ---------------------------------------------------------------------------

function PostForm({ onSuccess }: { onSuccess: () => void }) {
  const boardPost = usePluginAction("board_post");
  const [type, setType] = useState<EntryType>("DECISION");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [impact, setImpact] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 5,
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    color: "#1e293b",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    display: "block",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const handleSubmit = (): void => {
    if (!title.trim() || !summary.trim()) {
      setError("Title and Summary are required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const params: Record<string, string> = { type, title: title.trim(), summary: summary.trim() };
    if (context.trim()) params.context = context.trim();
    if (impact.trim()) params.impact = impact.trim();
    if (nextAction.trim()) params.nextAction = nextAction.trim();

    boardPost(params)
      .then(() => {
        setTitle("");
        setSummary("");
        setContext("");
        setImpact("");
        setNextAction("");
        onSuccess();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to post entry.");
      })
      .finally(() => setSubmitting(false));
  };

  const c = TYPE_COLORS[type];

  return (
    <div
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: "14px 20px",
        background: "#fafafa",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {/* Type selector */}
        <div style={{ flex: "0 0 auto" }}>
          <label style={labelStyle}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EntryType)}
            style={{
              ...inputStyle,
              width: "auto",
              paddingRight: "24px",
              background: c.bg,
              color: c.text,
              fontWeight: 700,
              fontSize: 11,
              border: `1px solid ${c.text}40`,
            }}
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Title <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title (max 120 chars)"
            maxLength={120}
          />
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: 6 }}>
        <label style={labelStyle}>Summary <span style={{ color: "#ef4444" }}>*</span></label>
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 48 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="1-3 sentences"
          rows={2}
        />
      </div>

      {/* Optional fields — collapsible row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Context (optional)</label>
          <input style={inputStyle} value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. ATL-12" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Impact (optional)</label>
          <input style={inputStyle} value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Who or what is affected" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Next action (optional)</label>
          <input style={inputStyle} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="What happens next" />
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 6 }}>⚠ {error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          padding: "7px 18px",
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Posting…" : "Post Entry"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardWidget — compact 5-entry feed
// ---------------------------------------------------------------------------

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data, loading, error } = usePluginData<BoardEntry[]>("entries");

  if (loading) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#94a3b8" }}>Loading...</div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#ef4444" }}>
        Error: {error.message}
      </div>
    );
  }

  // Announcements pinned first, then remaining entries up to 5 total
  const entries: BoardEntry[] = Array.isArray(data)
    ? [
        ...data.filter((e) => e.type === "ANNOUNCEMENT").slice(0, 2),
        ...data.filter((e) => e.type !== "ANNOUNCEMENT"),
      ].slice(0, 5)
    : [];

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 13, color: "#1e293b" }}>Bulletin Board</strong>
        {Array.isArray(data) && data.length > 0 && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{data.length} entries</span>
        )}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          No entries yet. Agents will post here after completing significant work.
        </div>
      ) : (
        entries.map((e) => <EntryCard key={e.id} entry={e} />)
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulletinBoardModal — full list with type filter tabs
// ---------------------------------------------------------------------------

const FILTER_TYPES: Array<EntryType | "ALL"> = [
  "ALL",
  "ANNOUNCEMENT",
  "DECISION",
  "FINDING",
  "RISK",
  "ACTION",
  "DATA",
];

export function BulletinBoardModal(_props: PluginWidgetProps) {
  const { data, loading, error, refresh } = usePluginData<BoardEntry[]>("entries");
  const [filter, setFilter] = useState<EntryType | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);

  const all: BoardEntry[] = Array.isArray(data) ? data : [];
  const visible = filter === "ALL" ? all : all.filter((e) => e.type === filter);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            Bulletin Board
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            Decisions, findings, risks, actions, and data outputs from the APEX team.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "6px 14px",
            background: showForm ? "#e0e7ff" : "#6366f1",
            color: showForm ? "#4338ca" : "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {showForm ? "✕ Cancel" : "+ New Entry"}
        </button>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {FILTER_TYPES.map((t) => {
          const count =
            t === "ALL" ? all.length : all.filter((e) => e.type === t).length;
          const active = filter === t;
          const c =
            t !== "ALL"
              ? TYPE_COLORS[t]
              : { bg: "#f1f5f9", text: "#475569" };
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: active ? c.text : "#e2e8f0",
                background: active ? c.bg : "#fff",
                color: active ? c.text : "#64748b",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {t}{" "}
              {count > 0 && (
                <span style={{ opacity: 0.7 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
        {loading && (
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading...</div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: "#ef4444" }}>
            Error: {error.message}
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: "#94a3b8",
              textAlign: "center",
              paddingTop: 40,
            }}
          >
            No{filter !== "ALL" ? ` ${filter.toLowerCase()}` : ""} entries yet.
          </div>
        )}
        {visible.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
      </div>

      {/* Post form — shown when "+ New Entry" is clicked */}
      {showForm && (
        <PostForm
          onSuccess={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarItem — left nav entry with self-managed modal
// ---------------------------------------------------------------------------

export function SidebarItem(_props: PluginWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 5,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          color: "inherit",
          userSelect: "none",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>
        Bulletin Board
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              width: "min(960px, 96vw)",
              height: "min(88vh, 840px)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <BulletinBoardModal {..._props} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ToolbarIcon — clipboard SVG button
// ---------------------------------------------------------------------------

export function ToolbarIcon(_props: PluginWidgetProps) {
  return (
    <button
      type="button"
      title="Bulletin Board"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
      Bulletin Board
    </button>
  );
}
