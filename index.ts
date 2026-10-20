import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Level = "normal" | "high" | "top";
const ENTRY = "pi-session";

// All state is keyed by session id: /new, /resume and /fork can all happen inside one process,
// so nothing may be global. Header reads resolve the live session id and never guess; every
// session's entry is rebuilt from its own branch at session_start.
const prio = new Map<string, Level>();
const slug = new Map<string, string>();
const slugNamed = new Set<string>(); // slug came from a user-set session name (wins over everything)
const slugUpgraded = new Set<string>(); // slug already upgraded from the first user message (once)
const autoName = new Map<string, string>(); // name we set ourselves (id -> slug), so /resume reads well

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function parseLevel(s: string): Level | undefined {
  const a = s.trim().toLowerCase();
  return a === "normal" || a === "high" || a === "top" ? a : undefined;
}

export function firstWords(text: string): string {
  return slugify(text).split("-").filter(Boolean).slice(0, 4).join("-");
}

function userText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content))
    return content
      .map((c: any) => (c?.type === "text" ? String(c.text ?? "") : ""))
      .join(" ")
      .trim();
  return "";
}

// Last priority claim on a session branch wins. A fork's fresh branch carries no entry,
// so a fork starts at normal (this is the fork-does-not-inherit rule).
export function lastPrio(entries: any[]): Level {
  let p: Level = "normal";
  for (const e of entries)
    if (e?.type === "custom" && e.customType === ENTRY) {
      const lvl = parseLevel(String(e?.data?.prio ?? ""));
      if (lvl) p = lvl;
    }
  return p;
}

function rebuild(pi: ExtensionAPI, ctx: ExtensionContext) {
  const sm = ctx.sessionManager;
  const id = sm.getSessionId();
  const entries = sm.getBranch() as any[];
  prio.set(id, lastPrio(entries));
  slugNamed.delete(id);
  slugUpgraded.delete(id);
  const name = sm.getSessionName();
  const nameSlug = name ? slugify(name) : "";
  if (nameSlug) {
    slug.set(id, nameSlug);
    if (nameSlug !== autoName.get(id)) slugNamed.add(id);
  } else {
    const firstUser = entries.find(
      (e) => e?.type === "message" && e?.message?.role === "user" && userText(e?.message?.content),
    );
    const textSlug = firstUser ? firstWords(userText(firstUser.message.content)) : "";
    slug.set(id, textSlug || slugify(baseName(sm.getCwd())) || "session");
    if (textSlug) slugUpgraded.add(id);
  }
  if (!name && !autoName.has(id)) {
    const s = slug.get(id)!;
    autoName.set(id, s);
    pi.setSessionName(s); // readable names in the /resume picker for free
  }
}

function baseName(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? "";
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_ev, ctx) => {
    rebuild(pi, ctx);
  });

  pi.on("session_info_changed", (ev, ctx) => {
    const id = ctx.sessionManager.getSessionId();
    const s = ev.name ? slugify(ev.name) : "";
    if (!s) return rebuild(pi, ctx); // name cleared -> fall back down the ladder
    slug.set(id, s);
    if (s !== autoName.get(id)) slugNamed.add(id);
  });

  pi.on("message_start", (ev, ctx) => {
    if ((ev.message as any)?.role !== "user") return;
    const id = ctx.sessionManager.getSessionId();
    if (slugNamed.has(id) || slugUpgraded.has(id)) return;
    const t = userText((ev.message as any).content);
    if (!t) return;
    slugUpgraded.add(id);
    const w = firstWords(t);
    if (w) slug.set(id, w);
  });

  pi.on("before_provider_headers", (ev, ctx) => {
    const id = ctx.sessionManager.getSessionId();
    ev.headers["x-session-id"] = id;
    ev.headers["x-session-name"] = slug.get(id) || "session";
    const lvl = prio.get(id) ?? "normal";
    ev.headers["x-session-priority"] = lvl === "normal" ? null : lvl; // null deletes the header
  });

  pi.registerCommand("prio", {
    description: "ollamaMQ session priority: /prio [normal|high|top]",
    handler: async (args, ctx) => {
      const id = ctx.sessionManager.getSessionId();
      const arg = (args ?? "").trim();
      if (!arg)
        return ctx.ui.notify(
          `priority=${prio.get(id) ?? "normal"} name=${slug.get(id) ?? "session"} id=${id}`,
          "info",
        );
      const lvl = parseLevel(arg);
      if (!lvl) return ctx.ui.notify("usage: /prio normal|high|top", "error");
      prio.set(id, lvl);
      pi.appendEntry(ENTRY, { prio: lvl });
      ctx.ui.notify(`priority=${lvl}`, "info");
    },
  });
}
