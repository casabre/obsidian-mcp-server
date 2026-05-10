import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getAllFilenames, readFilesByName, findOpenTodos, createReadTools } from "../read.js";

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

describe("getAllFilenames", () => {
  it("returns empty array for empty vault", async () => {
    expect(await getAllFilenames(tmpDir)).toEqual([]);
  });

  it("returns filenames sorted by modification time, newest first", async () => {
    write("old.md", "old");
    write("new.md", "new");
    const past = new Date(Date.now() - 10000);
    fs.utimesSync(path.join(tmpDir, "old.md"), past, past);
    const files = await getAllFilenames(tmpDir);
    expect(files[0]).toBe("new.md");
    expect(files[1]).toBe("old.md");
  });

  it("includes files in subdirectories", async () => {
    write("folder/note.md", "content");
    const files = await getAllFilenames(tmpDir);
    expect(files).toContain("folder/note.md");
  });

  it("excludes dot files and directories", async () => {
    write(".obsidian/config.json", "{}");
    write("visible.md", "content");
    const files = await getAllFilenames(tmpDir);
    expect(files).not.toContain(".obsidian/config.json");
    expect(files).toContain("visible.md");
  });
});

describe("readFilesByName", () => {
  beforeEach(() => {
    write("Notes/Project.md", "project content");
    write("daily.md", "daily content");
  });

  it("finds file by exact path", async () => {
    const result = await readFilesByName(tmpDir, ["Notes/Project.md"]);
    expect(result[0]).toContain("project content");
  });

  it("finds file by case-insensitive exact name", async () => {
    const result = await readFilesByName(tmpDir, ["notes/project.md"]);
    expect(result[0]).toContain("project content");
  });

  it("finds file by partial filename match", async () => {
    const result = await readFilesByName(tmpDir, ["proj"]);
    expect(result[0]).toContain("project content");
  });

  it("returns not-found message when no match", async () => {
    const result = await readFilesByName(tmpDir, ["nonexistent"]);
    expect(result[0]).toContain("File not found in vault.");
  });

  it("returns multiple files matching a partial name", async () => {
    write("project-a.md", "a");
    write("project-b.md", "b");
    const result = await readFilesByName(tmpDir, ["project-"]);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("prefixes each result with file header", async () => {
    const result = await readFilesByName(tmpDir, ["daily.md"]);
    expect(result[0]).toMatch(/^# File: daily\.md/);
  });

  it("returns not-found message when file becomes unreadable after glob", async () => {
    if (process.getuid?.() === 0) return;
    write("locked.md", "secret content");
    fs.chmodSync(path.join(tmpDir, "locked.md"), 0o000);
    const result = await readFilesByName(tmpDir, ["locked.md"]);
    expect(result[0]).toContain("File not found in vault.");
  });
});

describe("findOpenTodos", () => {
  it("returns empty array when no todos exist", async () => {
    write("note.md", "# Heading\nsome text");
    expect(await findOpenTodos(tmpDir)).toEqual([]);
  });

  it("returns open todo items with file location", async () => {
    write("tasks.md", "- [ ] buy milk\n- [x] done task");
    const todos = await findOpenTodos(tmpDir);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toContain("buy milk");
    expect(todos[0]).toContain("tasks.md");
  });

  it("ignores completed todos", async () => {
    write("tasks.md", "- [x] already done");
    expect(await findOpenTodos(tmpDir)).toEqual([]);
  });

  it("collects todos across multiple files", async () => {
    write("a.md", "- [ ] task a");
    write("b.md", "- [ ] task b");
    const todos = await findOpenTodos(tmpDir);
    expect(todos).toHaveLength(2);
  });

  it("skips unreadable files gracefully", async () => {
    if (process.getuid?.() === 0) return;
    write("locked.md", "- [ ] hidden todo");
    fs.chmodSync(path.join(tmpDir, "locked.md"), 0o000);
    const todos = await findOpenTodos(tmpDir);
    expect(todos).toEqual([]);
  });
});

describe("createReadTools", () => {
  it("returns three tools", () => {
    const tools = createReadTools(tmpDir);
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      "getAllFilenames",
      "readMultipleFiles",
      "getOpenTodos",
    ]);
  });

  it("getAllFilenames handler returns filenames text", async () => {
    write("note.md", "hello");
    const tool = createReadTools(tmpDir).find((t) => t.name === "getAllFilenames")!;
    const result = await tool.handler({}, {} as any);
    expect(result.content[0].text).toContain("note.md");
  });

  it("readMultipleFiles handler returns no-match message for empty filenames array", async () => {
    const tool = createReadTools(tmpDir).find((t) => t.name === "readMultipleFiles")!;
    const result = await tool.handler({ filenames: [] }, {} as any);
    expect(result.content[0].text).toBe("No matching files found in the vault.");
  });

  it("readMultipleFiles handler returns not-found message for unknown file", async () => {
    const tool = createReadTools(tmpDir).find((t) => t.name === "readMultipleFiles")!;
    const result = await tool.handler({ filenames: ["ghost.md"] }, {} as any);
    expect(result.content[0].text).toContain("File not found");
  });

  it("readMultipleFiles handler returns file contents", async () => {
    write("note.md", "hello world");
    const tool = createReadTools(tmpDir).find((t) => t.name === "readMultipleFiles")!;
    const result = await tool.handler({ filenames: ["note.md"] }, {} as any);
    expect(result.content[0].text).toContain("hello world");
  });

  it("getOpenTodos handler returns no-todos message when vault is empty", async () => {
    const tool = createReadTools(tmpDir).find((t) => t.name === "getOpenTodos")!;
    const result = await tool.handler({}, {} as any);
    expect(result.content[0].text).toBe("No open TODOs found in the vault.");
  });

  it("getOpenTodos handler returns todos when present", async () => {
    write("tasks.md", "- [ ] fix bug");
    const tool = createReadTools(tmpDir).find((t) => t.name === "getOpenTodos")!;
    const result = await tool.handler({}, {} as any);
    expect(result.content[0].text).toContain("fix bug");
  });
});
