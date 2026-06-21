import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tool, ToolResult } from "./types.js";
import { toErrorMessage, isEnoent, resolveWithinVault } from "./utils.js";
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

// Files permitted for deletion: markdown notes, common Obsidian vault
// attachments (images, audio, video, PDF, canvas), and extension-less files
// (e.g. "_Strava", "_Team"). Anything else is blocked as a safety guard.
export const DELETABLE_FILE_PATTERN =
  /(\.(md|markdown|png|jpe?g|gif|bmp|svg|webp|avif|pdf|mp3|m4a|wav|ogg|flac|3gp|mp4|mov|mkv|ogv|webm|canvas)$)|(^|[\\/])[^\\/.]+$/i;

export async function deleteFile(vaultPath: string, filePath: string): Promise<void> {
  if (!DELETABLE_FILE_PATTERN.test(filePath)) {
    throw new Error(`File type not allowed for deletion, got: ${filePath}`);
  }
  const fullPath = resolveWithinVault(vaultPath, filePath);
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
      "Permanently deletes a file from the Obsidian vault. Allows markdown notes (.md), common attachments (images, audio, video, PDF, canvas), and extension-less files. Other file types are blocked as a safety guard.",
    schema: {
      filePath: z
        .string()
        .regex(DELETABLE_FILE_PATTERN)
        .describe(
          "File path relative to vault root. Allows .md notes, common attachments (images, audio, video, PDF, canvas), and extension-less files."
        ),
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
