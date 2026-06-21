import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tool, ToolResult } from "./types.js";
import { promises as fsp } from "fs";
import path from "path";
import { z } from "zod";
import { glob } from "glob";

export async function getAllFilenames(dirPath: string): Promise<string[]> {
  const files = await glob("**/*", { cwd: dirPath, nodir: true, dot: false });
  const withStats = (
    await Promise.all(
      files.map(async (file) => {
        try {
          return { path: file, mtime: (await fsp.stat(path.join(dirPath, file))).mtime };
        } catch {
          /* v8 ignore next */
          return null; // file removed between glob and stat
        }
      })
    )
  ).filter((f): f is { path: string; mtime: Date } => f !== null);
  return withStats
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .map((f) => f.path);
}

export async function readFilesByName(
  rootPath: string,
  targetFilenames: string[]
): Promise<string[]> {
  const allFiles = await getAllFilenames(rootPath);
  const fileMap = new Map<string, string>();
  allFiles.forEach((file) => fileMap.set(file.toLowerCase(), file));

  const readAndFormat = async (filePath: string): Promise<string> => {
    try {
      const content = await fsp.readFile(path.join(rootPath, filePath), "utf8");
      return `# File: ${filePath}\n\n${content}`;
    } catch {
      return `# File: ${filePath}\n\nFile not found in vault.`;
    }
  };

  const results = await Promise.all(
    targetFilenames.map(async (targetName) => {
      if (allFiles.includes(targetName)) return [await readAndFormat(targetName)];

      const lower = targetName.toLowerCase();
      if (fileMap.has(lower)) return [await readAndFormat(fileMap.get(lower)!)];

      const partial = allFiles.filter((f) =>
        path.basename(f).toLowerCase().includes(lower)
      );
      if (partial.length > 0) return Promise.all(partial.map(readAndFormat));

      return [`# File: ${targetName}\n\nFile not found in vault.`];
    })
  );

  return results.flat();
}

export async function findOpenTodos(rootPath: string): Promise<string[]> {
  const mdFiles = await glob("**/*.md", { cwd: rootPath, nodir: true, dot: false });

  const perFile = await Promise.all(
    mdFiles.map(async (filePath) => {
      try {
        const content = await fsp.readFile(path.join(rootPath, filePath), "utf8");
        return content
          .split("\n")
          .filter((line) => /- \[ \] .+/.test(line))
          .map((line) => `- **${filePath}**: ${line.trim()}`);
      } catch {
        return []; // file removed or unreadable between glob and read
      }
    })
  );

  return perFile.flat();
}

export function createReadTools(vaultPath: string): tool<any>[] {
  const getAllFilenamesTool: tool<Record<string, never>> = {
    name: "getAllFilenames",
    description:
      "Get a list of all filenames in the Obsidian vault. Useful for retrieving their contents later.",
    schema: {},
    handler: async (_args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      const filenames = await getAllFilenames(vaultPath);
      return {
        content: [
          {
            type: "text",
            text: `# All markdown files in vault (note: today's date is ${
              new Date().toISOString().split("T")[0]
            })\n\n${filenames.join("\n")}`,
          },
        ],
      };
    },
  };

  const readMultipleFilesTool: tool<{ filenames: z.ZodArray<z.ZodString> }> = {
    name: "readMultipleFiles",
    description:
      "Retrieves the contents of specified files from the Obsidian vault. You can provide exact filenames (with or without path), partial filenames, or case-insensitive matches. Each file's content is prefixed with '# File: filename'.",
    schema: { filenames: z.array(z.string()) },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      const results = await readFilesByName(vaultPath, args.filenames);
      if (results.length === 0) {
        return { content: [{ type: "text", text: "No matching files found in the vault." }] };
      }
      return { content: [{ type: "text", text: results.join("\n\n") }] };
    },
  };

  const getOpenTodosTool: tool<Record<string, never>> = {
    name: "getOpenTodos",
    description:
      "Retrieves all open TODO items in the Obsidian vault with their file locations. Useful for getting an overview of pending tasks.",
    schema: {},
    handler: async (_args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      const todos = await findOpenTodos(vaultPath);
      if (todos.length === 0) {
        return { content: [{ type: "text", text: "No open TODOs found in the vault." }] };
      }
      return {
        content: [
          {
            type: "text",
            text: `# Open TODOs in vault (${todos.length} items)\n\n${todos.join("\n")}`,
          },
        ],
      };
    },
  };

  return [getAllFilenamesTool, readMultipleFilesTool, getOpenTodosTool];
}
