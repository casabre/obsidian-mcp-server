import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { moveFile, deleteFile, createManageTools } from "../manage.js";

let tmpDir: string;

function write(relPath: string, content: string = "") {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(tmpDir, relPath));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("moveFile", () => {
  it("moves a file to a new path", async () => {
    write("source.md", "content");
    await moveFile(tmpDir, "source.md", "dest.md");
    expect(exists("source.md")).toBe(false);
    expect(exists("dest.md")).toBe(true);
  });

  it("creates destination directories if missing", async () => {
    write("note.md", "content");
    await moveFile(tmpDir, "note.md", "folder/sub/note.md");
    expect(exists("folder/sub/note.md")).toBe(true);
  });

  it("throws when source file does not exist", async () => {
    await expect(moveFile(tmpDir, "ghost.md", "dest.md")).rejects.toThrow(
      "Source file not found"
    );
  });

  it("re-throws non-ENOENT error from rename", async () => {
    write("source.md", "content");
    // renaming a file onto an existing directory produces EISDIR, not ENOENT
    fs.mkdirSync(path.join(tmpDir, "dest-dir"));
    const err: NodeJS.ErrnoException = await moveFile(tmpDir, "source.md", "dest-dir").catch(
      (e) => e
    );
    expect(err.code).not.toBe("ENOENT");
    expect(err.message).not.toContain("Source file not found");
  });
});

describe("deleteFile", () => {
  it("deletes an existing .md file", async () => {
    write("note.md");
    await deleteFile(tmpDir, "note.md");
    expect(exists("note.md")).toBe(false);
  });

  it("throws when file does not exist", async () => {
    await expect(deleteFile(tmpDir, "ghost.md")).rejects.toThrow("File not found");
  });

  it("deletes a common attachment file (image)", async () => {
    write("image.png");
    await deleteFile(tmpDir, "image.png");
    expect(exists("image.png")).toBe(false);
  });

  it("deletes an extension-less file", async () => {
    write("_Strava");
    await deleteFile(tmpDir, "_Strava");
    expect(exists("_Strava")).toBe(false);
  });

  it("throws for disallowed file types", async () => {
    await expect(deleteFile(tmpDir, "archive.tar.gz")).rejects.toThrow(
      "File type not allowed for deletion"
    );
  });

  it("refuses to delete a path that escapes the vault", async () => {
    await expect(deleteFile(tmpDir, "../../etc/passwd")).rejects.toThrow(
      "Path escapes the vault"
    );
  });

  it("re-throws non-ENOENT error from unlink", async () => {
    // unlinking a directory produces EPERM/EISDIR, not ENOENT
    fs.mkdirSync(path.join(tmpDir, "subdir.md"));
    const err: NodeJS.ErrnoException = await deleteFile(tmpDir, "subdir.md").catch((e) => e);
    expect(err.code).not.toBe("ENOENT");
    expect(err.message).not.toContain("File not found");
  });
});

describe("createManageTools", () => {
  it("returns two tools", () => {
    const tools = createManageTools(tmpDir);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["moveFile", "deleteFile"]);
  });

  describe("moveFile handler", () => {
    it("returns success message on move", async () => {
      write("a.md", "content");
      const tool = createManageTools(tmpDir).find((t) => t.name === "moveFile")!;
      const result = await tool.handler({ sourcePath: "a.md", destinationPath: "b.md" }, {} as any);
      expect(result.content[0].text).toContain("Successfully moved");
      expect(result.content[0].text).toContain("a.md → b.md");
    });

    it("returns error message when source missing", async () => {
      const tool = createManageTools(tmpDir).find((t) => t.name === "moveFile")!;
      const result = await tool.handler({ sourcePath: "ghost.md", destinationPath: "b.md" }, {} as any);
      expect(result.content[0].text).toContain("Error moving file");
    });
  });

  describe("deleteFile handler", () => {
    it("returns success message on delete", async () => {
      write("note.md");
      const tool = createManageTools(tmpDir).find((t) => t.name === "deleteFile")!;
      const result = await tool.handler({ filePath: "note.md" }, {} as any);
      expect(result.content[0].text).toContain("Successfully deleted");
    });

    it("returns error message when file missing", async () => {
      const tool = createManageTools(tmpDir).find((t) => t.name === "deleteFile")!;
      const result = await tool.handler({ filePath: "ghost.md" }, {} as any);
      expect(result.content[0].text).toContain("Error deleting file");
    });

    it("returns error message for non-.md file", async () => {
      const tool = createManageTools(tmpDir).find((t) => t.name === "deleteFile")!;
      const result = await tool.handler({ filePath: "image.png" }, {} as any);
      expect(result.content[0].text).toContain("Error deleting file");
    });
  });
});
