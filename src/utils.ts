import { existsSync } from "fs";
import { access } from "fs/promises";

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export const validateVaultPath = (path: string | undefined): string => {
  if (!path) {
    throw new Error(
      "Vault path must be provided as a command line argument.\nUsage: <command> <vault_path>"
    );
  }

  if (!existsSync(path)) {
    throw new Error(
      `Invalid vault path: "${path}"\nPlease provide a path to an existing Obsidian vault`
    );
  }

  return path;
};
