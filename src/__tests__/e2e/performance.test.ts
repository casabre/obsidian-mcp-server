import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getAllFilenames, findOpenTodos } from "../../read.js";
import { searchVault } from "../../search.js";
import { writeFile } from "../../write.js";

const FILE_COUNT = 200;
const TIME_BUDGET_MS = 8000;

let tmpDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-e2e-"));
  await Promise.all(
    Array.from({ length: FILE_COUNT }, (_, i) =>
      fs.promises.writeFile(
        path.join(tmpDir, `note-${String(i).padStart(3, "0")}.md`),
        `# Note ${i}\n\nContent for note ${i}.\n- [ ] todo item ${i}\n`
      )
    )
  );
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe(`E2E performance on ${FILE_COUNT}-file vault`, () => {
  it("getAllFilenames returns all files within time budget", async () => {
    const start = Date.now();
    const files = await getAllFilenames(tmpDir);
    const elapsed = Date.now() - start;
    expect(files).toHaveLength(FILE_COUNT);
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
  }, TIME_BUDGET_MS + 2000);

  it("findOpenTodos scans all files within time budget", async () => {
    const start = Date.now();
    const todos = await findOpenTodos(tmpDir);
    const elapsed = Date.now() - start;
    expect(todos).toHaveLength(FILE_COUNT);
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
  }, TIME_BUDGET_MS + 2000);

  it("searchVault scans all files within time budget", async () => {
    const start = Date.now();
    const matches = await searchVault(tmpDir, "content for note", false, FILE_COUNT);
    const elapsed = Date.now() - start;
    expect(matches.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
  }, TIME_BUDGET_MS + 2000);

  it("searchVault respects maxResults and returns early", async () => {
    const cap = 10;
    const matches = await searchVault(tmpDir, "note", false, cap);
    expect(matches).toHaveLength(cap);
  });

  it("50 concurrent writes complete within time budget", async () => {
    const batchSize = 50;
    const start = Date.now();
    await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        writeFile(tmpDir, `batch/write-${i}.md`, `# Batch write ${i}`)
      )
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
    const files = await getAllFilenames(tmpDir);
    expect(files.filter((f) => f.startsWith("batch/"))).toHaveLength(batchSize);
  }, TIME_BUDGET_MS + 2000);
});
