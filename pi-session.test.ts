import { expect, test } from "bun:test";
import { firstWords, lastPrio, parseLevel, slugify } from "./index.ts";

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
