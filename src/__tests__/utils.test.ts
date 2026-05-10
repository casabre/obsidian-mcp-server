import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { validateVaultPath, toErrorMessage, pathExists, isEnoent } from "../utils.js";

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
