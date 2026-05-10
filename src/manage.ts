import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tool, ToolResult } from "./types.js";
import { toErrorMessage, isEnoent } from "./utils.js";
import { promises as fsp } from "fs";
import path from "path";
import { z } from "zod";

export async function moveFile(
  vaultPath: string,
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const fullSource = path.join(vaultPath, sourcePath);
  const fullDest = path.join(vaultPath, destinationPath);
  await fsp.mkdir(path.dirname(fullDest), { recursive: true });
  try {
    await fsp.rename(fullSource, fullDest);
  } catch (error) {
    if (isEnoent(error)) throw new Error(`Source file not found: ${sourcePath}`);
    throw error;
  }
}

export async function deleteFile(vaultPath: string, filePath: string): Promise<void> {
  if (!filePath.endsWith(".md")) {
    throw new Error(`Only .md files can be deleted, got: ${filePath}`);
  }
  const fullPath = path.join(vaultPath, filePath);
  try {
    await fsp.unlink(fullPath);
  } catch (error) {
    if (isEnoent(error)) throw new Error(`File not found: ${filePath}`);
    throw error;
  }
}

export function createManageTools(vaultPath: string): tool<any>[] {
  const moveFileTool: tool<{
    sourcePath: z.ZodString;
    destinationPath: z.ZodString;
  }> = {
    name: "moveFile",
    description:
      "Moves or renames a file within the Obsidian vault. Creates destination directories if they don't exist.",
    schema: {
      sourcePath: z.string().describe("Current file path relative to vault root"),
      destinationPath: z.string().describe("New file path relative to vault root"),
    },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      try {
        await moveFile(vaultPath, args.sourcePath, args.destinationPath);
        return {
          content: [
            { type: "text", text: `Successfully moved: ${args.sourcePath} → ${args.destinationPath}` },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error moving file: ${toErrorMessage(error)}` }],
        };
      }
    },
  };

  const deleteFileTool: tool<{ filePath: z.ZodString }> = {
    name: "deleteFile",
    description:
      "Permanently deletes a markdown file from the Obsidian vault. Only .md files can be deleted as a safety guard. Provide a file path ending in .md.",
    schema: {
      filePath: z
        .string()
        .regex(/\.md$/)
        .describe("File path relative to vault root (must end in .md)"),
    },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      try {
        await deleteFile(vaultPath, args.filePath);
        return {
          content: [{ type: "text", text: `Successfully deleted: ${args.filePath}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error deleting file: ${toErrorMessage(error)}` }],
        };
      }
    },
  };

  return [moveFileTool, deleteFileTool];
}
