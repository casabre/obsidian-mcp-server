import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { tool, ToolResult } from "./types.js";
import { promises as fsp } from "fs";
import path from "path";
import { z } from "zod";
import { glob } from "glob";

export type SearchMatch = {
  file: string;
  line: number;
  text: string;
};

export async function searchVault(
  vaultPath: string,
  query: string,
  caseSensitive: boolean = false,
  maxResults: number = 200
): Promise<SearchMatch[]> {
  const mdFiles = await glob("**/*.md", { cwd: vaultPath, nodir: true, dot: false });
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: SearchMatch[] = [];

  for (const filePath of mdFiles) {
    if (matches.length >= maxResults) break;

    let content: string;
    try {
      content = await fsp.readFile(path.join(vaultPath, filePath), "utf8");
    } catch {
      continue; // file removed or unreadable between glob and read
    }

    for (const [index, lineText] of content.split("\n").entries()) {
      const haystack = caseSensitive ? lineText : lineText.toLowerCase();
      if (haystack.includes(needle)) {
        matches.push({ file: filePath, line: index + 1, text: lineText.trim() });
        if (matches.length >= maxResults) break;
      }
    }
  }

  return matches;
}

export function createSearchTools(vaultPath: string): tool<any>[] {
  const searchNotesTool: tool<{
    query: z.ZodString;
    caseSensitive: z.ZodOptional<z.ZodBoolean>;
    maxResults: z.ZodOptional<z.ZodNumber>;
  }> = {
    name: "searchNotes",
    description:
      "Searches the full text of all markdown files in the Obsidian vault for a query string. Returns matching lines with their file path and line number. Case-insensitive by default (set caseSensitive: true to override). Capped at 200 results by default (override with maxResults). Use this to find notes about a topic without knowing the filename.",
    schema: {
      query: z.string().describe("Text to search for across all notes"),
      caseSensitive: z
        .boolean()
        .optional()
        .describe("Whether the search is case-sensitive (default: false)"),
      maxResults: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of results to return (default: 200)"),
    },
    handler: async (args, _extra: RequestHandlerExtra<any, any>): Promise<ToolResult> => {
      const limit = args.maxResults ?? 200;
      const matches = await searchVault(vaultPath, args.query, args.caseSensitive ?? false, limit);
      if (matches.length === 0) {
        return { content: [{ type: "text", text: `No matches found for "${args.query}".` }] };
      }
      const formatted = matches.map((m) => `${m.file}:${m.line}: ${m.text}`).join("\n");
      const truncationNote =
        matches.length === limit
          ? `\n\n_(results capped at ${limit} — use maxResults or a more specific query to narrow down)_`
          : "";
      return {
        content: [
          {
            type: "text",
            text: `# Search results for "${args.query}" (${matches.length} matches)\n\n${formatted}${truncationNote}`,
          },
        ],
      };
    },
  };

  return [searchNotesTool];
}
