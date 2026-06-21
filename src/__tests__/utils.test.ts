import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  validateVaultPath,
  toErrorMessage,
  pathExists,
  isEnoent,
  resolveWithinVault,
} from "../utils.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("validateVaultPath", () => {
  it("throws when no argument provided", () => {
    expect(() => validateVaultPath(undefined)).toThrow("Vault path must be provided");
  });

  it("throws when path does not exist", () => {
    expect(() => validateVaultPath("/nonexistent/path/xyz")).toThrow("Invalid vault path");
  });

  it("returns the path when it exists", () => {
    expect(validateVaultPath(tmpDir)).toBe(tmpDir);
  });
});

describe("resolveWithinVault", () => {
  it("resolves a normal file inside the vault", () => {
    expect(resolveWithinVault(tmpDir, "note.md")).toBe(path.join(tmpDir, "note.md"));
  });

  it("resolves a nested file inside the vault", () => {
    expect(resolveWithinVault(tmpDir, "folder/sub/note.md")).toBe(
      path.join(tmpDir, "folder/sub/note.md")
    );
  });

  it("allows a path that resolves to the vault root itself", () => {
    expect(resolveWithinVault(tmpDir, ".")).toBe(path.resolve(tmpDir));
  });

  it("throws when the path escapes the vault via traversal", () => {
    expect(() => resolveWithinVault(tmpDir, "../../etc/passwd")).toThrow(
      "Path escapes the vault"
    );
  });

  it("throws when the path resolves next to the vault (prefix attack)", () => {
    expect(() => resolveWithinVault(tmpDir, "../" + path.basename(tmpDir) + "-evil")).toThrow(
      "Path escapes the vault"
    );
  });
});

describe("toErrorMessage", () => {
  it("returns message property for Error instances", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns String() for non-Error values", () => {
    expect(toErrorMessage("raw string")).toBe("raw string");
    expect(toErrorMessage(42)).toBe("42");
  });
});

describe("isEnoent", () => {
  it("returns true for ENOENT error code", () => {
    const err = Object.assign(new Error("no such file"), { code: "ENOENT" });
    expect(isEnoent(err)).toBe(true);
  });

  it("returns false for other error codes", () => {
    const err = Object.assign(new Error("permission denied"), { code: "EACCES" });
    expect(isEnoent(err)).toBe(false);
  });

  it("returns false for plain Error without code", () => {
    expect(isEnoent(new Error("plain"))).toBe(false);
  });
});

describe("pathExists", () => {
  it("returns true for an existing path", async () => {
    expect(await pathExists(tmpDir)).toBe(true);
  });

  it("returns false for a non-existing path", async () => {
    expect(await pathExists(path.join(tmpDir, "ghost"))).toBe(false);
  });
});
