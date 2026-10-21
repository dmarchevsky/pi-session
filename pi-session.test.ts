import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstWords, lastPrio, parseLevel, slugify } from "./index.ts";
import extension from "./index.ts";

// Regression: pi only discovers package resources via the `pi` manifest or
// conventional dirs; without one the package installed but loaded nothing.
test("package.json declares the pi manifest so the extension is discovered", () => {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  const exts = pkg.pi?.extensions;
  expect(Array.isArray(exts)).toBe(true);
  for (const e of exts) expect(existsSync(resolve(import.meta.dir, e))).toBe(true);
});

test("slugify strips emoji and punctuation", () => {
  expect(slugify("Fix 🐛 login!!")).toBe("fix-login");
});

test("slugify folds accents and drops non-latin", () => {
  expect(slugify("Café Naïve")).toBe("cafe-naive");
  expect(slugify("Привет мир")).toBe(""); // nothing latin survives -> caller falls back
});

test("slugify caps at 64 chars", () => {
  expect(slugify("a".repeat(70))).toHaveLength(64);
});

test("slugify of junk is empty", () => {
  expect(slugify("!!! ☕")).toBe("");
});

test("firstWords keeps ~4 words", () => {
  expect(firstWords("tell me about your capabilities")).toBe("tell-me-about-your");
  expect(firstWords("For git folders, add ability to show git log")).toBe("for-git-folders-add");
  expect(firstWords("Привет мир")).toBe("");
});

test("parseLevel accepts the three levels only", () => {
  expect(parseLevel("high")).toBe("high");
  expect(parseLevel(" TOP ")).toBe("top");
  expect(parseLevel("normal")).toBe("normal");
  expect(parseLevel("urgent")).toBeUndefined();
  expect(parseLevel("")).toBeUndefined();
});

const e = (prio: unknown) => ({ type: "custom", customType: "pi-session", data: { prio } });

test("lastPrio: no claim -> normal", () => {
  expect(lastPrio([])).toBe("normal");
  expect(lastPrio([{ type: "message", message: { role: "user" } }])).toBe("normal"); // fork branch: parent's entry absent
});

test("lastPrio: last valid claim wins, garbage ignored", () => {
  expect(lastPrio([e("high"), e("top")])).toBe("top");
  expect(lastPrio([e("top"), e("normal")])).toBe("normal");
  expect(lastPrio([e("nope"), e("high"), { type: "custom", customType: "other", data: { prio: "top" } }])).toBe("high");
  expect(lastPrio([e(undefined)])).toBe("normal");
});

// Fake pi harness: captures event handlers and setSessionName calls, mimicking pi's session store.
let seq = 0;
function harness(cwd = "/home/x/dev-flow") {
  const id = `s${++seq}`;
  const handlers: Record<string, (ev: any, ctx: any) => void> = {};
  const renames: string[] = [];
  let name: string | undefined;
  const pi: any = {
    on: (ev: string, h: (ev: any, ctx: any) => void) => {
      handlers[ev] = h;
    },
    registerCommand: () => {},
    setSessionName: (n: string) => {
      renames.push(n);
      name = n;
      handlers.session_info_changed?.({ name: n }, ctx); // pi fires this on every rename
    },
  };
  const ctx: any = {
    sessionManager: {
      getSessionId: () => id,
      getBranch: () => [] as any[],
      getSessionName: () => name,
      getCwd: () => cwd,
    },
    ui: { notify: () => {} },
  };
  extension(pi);
  handlers.session_start({}, ctx);
  const userMsg = (text: string) =>
    handlers.message_start({ message: { role: "user", content: [{ type: "text", text }] } }, ctx);
  const headerSlug = () => {
    const headers: Record<string, string | null> = {};
    handlers.before_provider_headers({ headers }, ctx);
    return headers["x-session-name"];
  };
  return { ctx, handlers, renames, userMsg, headerSlug, getName: () => name, rename: (n: string) => {
    name = n;
    handlers.session_info_changed({ name: n }, ctx);
  } };
}

test("first-message upgrade renames the auto-name so UI and header slug stay equal", () => {
  const h = harness();
  expect(h.getName()).toBe("dev-flow"); // auto-named from cwd at session_start
  h.userMsg("some releases need only merge of PR and CHANGELOG update");
  expect(h.getName()).toBe("some-releases-need-only");
  expect(h.headerSlug()).toBe("some-releases-need-only");
  h.userMsg("second message must not rename again");
  expect(h.renames).toEqual(["dev-flow", "some-releases-need-only"]);
  expect(h.headerSlug()).toBe("some-releases-need-only");
});

test("a user-set name wins: no upgrade rename, header follows the name", () => {
  const h = harness();
  h.rename("authentication"); // pi-web / user rename mid-session
  h.userMsg("current implementation tangles together remote access");
  expect(h.getName()).toBe("authentication");
  expect(h.headerSlug()).toBe("authentication");
});

test("empty first message defers the upgrade to the next real message", () => {
  const h = harness();
  h.userMsg("   ");
  expect(h.renames).toEqual(["dev-flow"]); // no upgrade yet
  h.userMsg("fix the login bug now");
  expect(h.getName()).toBe("fix-the-login-bug"); // firstWords keeps 4 words
  expect(h.headerSlug()).toBe("fix-the-login-bug");
});
