import { tool, ToolResult } from "./types.js";
import { toErrorMessage } from "./utils.js";

type Handler = tool<any>["handler"];

/**
 * Time budget for a single tool call. The MCP SDK does not time out handlers,
 * so without this a stuck filesystem operation would hang the client forever.
 */
export const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/** Rejects with a timeout error if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Operation "${label}" timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Wraps a tool handler so it can neither crash the server nor hang the client:
 * any thrown/rejected error or timeout is converted into a normal ToolResult
 * describing the failure. Errors are logged to stderr (never stdout, which
 * carries the JSON-RPC stream).
 */
export function makeSafeHandler(
  name: string,
  handler: Handler,
  timeoutMs: number = DEFAULT_TOOL_TIMEOUT_MS
): Handler {
  return async (args, extra): Promise<ToolResult> => {
    try {
      return await withTimeout(
        Promise.resolve().then(() => handler(args, extra)),
        timeoutMs,
        name
      );
    } catch (error) {
      console.error(`[obsidian-mcp] tool "${name}" failed:`, error);
      return {
        content: [{ type: "text", text: `Error running ${name}: ${toErrorMessage(error)}` }],
      };
    }
  };
}

/**
 * Installs process-level guards so an unexpected error in any background promise
 * or callback logs to stderr instead of terminating the server and dropping the
 * MCP connection mid-session.
 */
export function installCrashGuards(): void {
  process.on("uncaughtException", (error) => {
    console.error("[obsidian-mcp] uncaughtException (server kept alive):", error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[obsidian-mcp] unhandledRejection (server kept alive):", reason);
  });
}
