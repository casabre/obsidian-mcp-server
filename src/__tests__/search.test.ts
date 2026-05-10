import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { searchVault, createSearchTools } from "../search.js";

let tmpDir: string;

function write(relPath: string, content: string) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("searchVault", () => {
  it("returns empty array when vault has no files", async () => {
    expect(await searchVault(tmpDir, "anything")).toEqual([]);
  });

  it("returns empty array when query has no matches", async () => {
    write("note.md", "hello world");
    expect(await searchVault(tmpDir, "zzznomatch")).toEqual([]);
  });

  it("finds a match in a single file", async () => {
    write("note.md", "line one\nfind me\nline three");
    const results = await searchVault(tmpDir, "find me");
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("note.md");
    expect(results[0].line).toBe(2);
    expect(results[0].text).toBe("find me");
  });

  it("finds matches across multiple files", async () => {
    write("a.md", "target word here");
    write("b.md", "another target line");
    const results = await searchVault(tmpDir, "target");
    expect(results).toHaveLength(2);
  });

  it("is case-insensitive by default", async () => {
    write("note.md", "Hello World");
    const results = await searchVault(tmpDir, "hello world");
    expect(results).toHaveLength(1);
  });

  it("respects case-sensitive flag", async () => {
    write("note.md", "Hello World\nhello world");
    const sensitive = await searchVault(tmpDir, "Hello World", true);
    expect(sensitive).toHaveLength(1);
    expect(sensitive[0].line).toBe(1);
  });

  it("returns correct line numbers", async () => {
    write("note.md", "alpha\nbeta\ngamma\nbeta again");
    const results = await searchVault(tmpDir, "beta");
    expect(results.map((r) => r.line)).toEqual([2, 4]);
  });

  it("caps results at maxResults", async () => {
    write("note.md", Array.from({ length: 20 }, (_, i) => `match line ${i}`).join("\n"));
    const results = await searchVault(tmpDir, "match", false, 5);
    expect(results).toHaveLength(5);
  });

  it("skips unreadable files gracefully", async () => {
    if (process.getuid?.() === 0) return;
    write("locked.md", "match this line");
    fs.chmodSync(path.join(tmpDir, "locked.md"), 0o000);
    const results = await searchVault(tmpDir, "match");
    expect(results).toEqual([]);
  });
});

describe("createSearchTools", () => {
  it("returns one tool named searchNotes", () => {
    const tools = createSearchTools(tmpDir);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("searchNotes");
  });

  it("returns no-match message when nothing found", async () => {
    const tool = createSearchTools(tmpDir)[0];
    const result = await tool.handler({ query: "ghost" }, {} as any);
    expect(result.content[0].text).toContain('No matches found for "ghost"');
  });

  it("returns formatted matches when found", async () => {
    write("note.md", "important idea here");
    const tool = createSearchTools(tmpDir)[0];
    const result = await tool.handler({ query: "important" }, {} as any);
    expect(result.content[0].text).toContain("note.md:1:");
    expect(result.content[0].text).toContain("1 matches");
  });

  it("passes caseSensitive flag through", async () => {
    write("note.md", "Hello\nhello");
    const tool = createSearchTools(tmpDir)[0];
    const sensitive = await tool.handler({ query: "Hello", caseSensitive: true }, {} as any);
    expect(sensitive.content[0].text).toContain("1 matches");
  });

  it("defaults to case-insensitive when caseSensitive is undefined", async () => {
    write("note.md", "Hello\nhello");
    const tool = createSearchTools(tmpDir)[0];
    const result = await tool.handler({ query: "hello" }, {} as any);
    expect(result.content[0].text).toContain("2 matches");
  });

  it("shows truncation note when results hit the cap", async () => {
    write("note.md", Array.from({ length: 5 }, (_, i) => `hit ${i}`).join("\n"));
    const tool = createSearchTools(tmpDir)[0];
    const result = await tool.handler({ query: "hit", maxResults: 3 }, {} as any);
    expect(result.content[0].text).toContain("capped at 3");
  });

  it("omits truncation note when results are under the cap", async () => {
    write("note.md", "one hit here");
    const tool = createSearchTools(tmpDir)[0];
    const result = await tool.handler({ query: "hit" }, {} as any);
    expect(result.content[0].text).not.toContain("capped");
  });
});
