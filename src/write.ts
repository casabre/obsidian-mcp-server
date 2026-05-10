import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tool, ToolResult } from "./types.js";
import { toErrorMessage, pathExists } from "./utils.js";
import { promises as fsp } from "fs";
import path from "path";
import { z } from "zod";

export async function writeFile(
  vaultPath: string,
  filePath: string,
  content: string
): Promise<boolean> {
  const fullPath = path.join(vaultPath, filePath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  const existed = await pathExists(fullPath);
  await fsp.writeFile(fullPath, content, "utf8");
  return existed;
}

export async function appendFile(
  vaultPath: string,
  filePath: string,
  content: string
): Promise<boolean> {
  const fullPath = path.join(vaultPath, filePath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  const existed = await pathExists(fullPath);
  await fsp.appendFile(fullPath, content, "utf8");
  return existed;
}

export function createWriteTools(vaultPath: string): tool<any>[] {
  const updateFileContentTool: tool<{
    filePath: z.ZodString;
    content: z.ZodString;
  }> = {
    name: "updateFileContent",
    description:
      "Updates the content of a specified file in the Obsidian vault with new markdown content. If the file doesn't exist, it will be created. Parent directories are created automatically. Accepts a file path (relative to vault root) and the full new content.",
    schema: {
      filePath: z.string().describe("File path relative to the vault root"),
      content: z.string().describe("Markdown content to write to the file"),
    },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      try {
        const existed = await writeFile(vaultPath, args.filePath, args.content);
        return {
          content: [
            {
              type: "text",
              text: existed
                ? `Successfully updated existing file: ${args.filePath}`
                : `Successfully created new file: ${args.filePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating file: ${toErrorMessage(error)}` }],
        };
      }
    },
  };

  const appendToFileTool: tool<{
    filePath: z.ZodString;
    content: z.ZodString;
  }> = {
    name: "appendToFile",
    description:
      "Appends content to the end of a file in the Obsidian vault. If the file doesn't exist, it will be created. Parent directories are created automatically. Useful for adding new todo items, journal entries, or notes without rewriting the entire file.",
    schema: {
      filePath: z.string().describe("File path relative to the vault root"),
      content: z.string().describe("Markdown content to append to the file"),
    },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      try {
        const existed = await appendFile(vaultPath, args.filePath, args.content);
        return {
          content: [
            {
              type: "text",
              text: existed
                ? `Successfully appended to file: ${args.filePath}`
                : `Successfully created and wrote new file: ${args.filePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error appending to file: ${toErrorMessage(error)}` }],
        };
      }
    },
  };

  return [updateFileContentTool, appendToFileTool];
}
