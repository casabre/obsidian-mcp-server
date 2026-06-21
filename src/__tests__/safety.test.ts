import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout, makeSafeHandler, installCrashGuards } from "../safety.js";
import { ToolResult } from "../types.js";

const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000, "fast")).resolves.toBe("done");
  });

  it("rejects with a timeout error when the promise is too slow", async () => {
    const neverSettles = new Promise<string>(() => {});
    await expect(withTimeout(neverSettles, 10, "slow")).rejects.toThrow(
      'Operation "slow" timed out after 10ms'
    );
  });

  it("propagates the original rejection when it loses the race", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 1000, "err")
    ).rejects.toThrow("boom");
  });
});

describe("makeSafeHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes through a successful result unchanged", async () => {
    const handler = makeSafeHandler("greet", async () => ok("hi"));
    expect(await handler({}, {} as any)).toEqual(ok("hi"));
  });

  it("converts an async rejection into an error ToolResult", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = makeSafeHandler("explode", async () => {
      throw new Error("kaboom");
    });
    const result = await handler({}, {} as any);
    expect(result.content[0].text).toBe("Error running explode: kaboom");
  });

  it("converts a synchronous throw into an error ToolResult", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = makeSafeHandler("syncthrow", (() => {
      throw new Error("sync boom");
    }) as any);
    const result = await handler({}, {} as any);
    expect(result.content[0].text).toBe("Error running syncthrow: sync boom");
  });

  it("returns an error ToolResult when the handler exceeds the timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = makeSafeHandler("hang", () => new Promise<ToolResult>(() => {}), 10);
    const result = await handler({}, {} as any);
    expect(result.content[0].text).toContain('timed out after 10ms');
  });
});

describe("installCrashGuards", () => {
  it("logs uncaught exceptions to stderr without exiting", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    installCrashGuards();
    const listeners = process.listeners("uncaughtException");
    const added = listeners[listeners.length - 1];
    added(new Error("uncaught"), "uncaughtException");
    expect(spy).toHaveBeenCalledWith(
      "[obsidian-mcp] uncaughtException (server kept alive):",
      expect.any(Error)
    );
    process.removeListener("uncaughtException", added);
    spy.mockRestore();
  });

  it("logs unhandled rejections to stderr without exiting", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    installCrashGuards();
    const listeners = process.listeners("unhandledRejection");
    const added = listeners[listeners.length - 1];
    (added as (reason: unknown, promise: Promise<unknown>) => void)(
      new Error("rejected"),
      Promise.resolve()
    );
    expect(spy).toHaveBeenCalledWith(
      "[obsidian-mcp] unhandledRejection (server kept alive):",
      expect.any(Error)
    );
    process.removeListener("unhandledRejection", added);
    spy.mockRestore();
  });
});
