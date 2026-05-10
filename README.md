# Obsidian MCP Server

A lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that enables AI assistants like Cursor & Claude to read from and write to your Obsidian vault directly via the filesystem — no Obsidian app required.

## Example Interactions

- "Create a new note for standup tomorrow describing the code changes I've made today" (should also use Git)
- "Check my notes about project ideas"
- "Check what todos I have related to refactoring"
- "Search my notes for anything about authentication"
- "Append this meeting summary to my daily note"
- "Move the draft in Inbox/idea.md to Projects/idea.md"

## Tools

### Read

1. **getAllFilenames**
   - Gets a list of all filenames in the Obsidian vault, sorted by most recently modified
   - Useful for discovering what files are available

2. **readMultipleFiles**
   - Retrieves the contents of specified files from the Obsidian vault
   - Supports exact filenames, partial filenames, or case-insensitive matches
   - Each file's content is prefixed with `# File: filename` for clear identification

3. **getOpenTodos**
   - Retrieves all open TODO items from markdown files in the Obsidian vault
   - Finds unchecked checkbox items (lines containing `- [ ]`)
   - Returns them with their file locations

4. **searchNotes**
   - Full-text search across all markdown files in the vault
   - Returns matching lines with file path and line number (`file:line: text`)
   - Case-insensitive by default; set `caseSensitive: true` to override
   - Use this to find notes about a topic without knowing the filename

### Write

1. **writeFile**
   - Updates the content of a specified file with new markdown content
   - Creates the file (and any parent directories) if it doesn't exist
   - Replaces the entire file content

2. **appendToFile**
   - Appends content to the end of a file without replacing it
   - Creates the file (and any parent directories) if it doesn't exist
   - Useful for adding new todo items, journal entries, or notes

### Manage

1. **moveFile**
   - Moves or renames a file within the vault
   - Automatically creates destination directories if needed

2. **deleteFile**
   - Permanently deletes a markdown file from the vault
   - Only `.md` files can be deleted as a safety guard

## Install & build

Clone the repository and build from source:

```bash
git clone https://github.com/marcelmarais/obsidian-mcp-server.git
cd obsidian-mcp-server
npm install
npm run build
```

## Integrating with Claude Desktop and Cursor

### Claude Desktop

Add the server to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": [
        "/absolute/path/to/obsidian-mcp-server/build/index.js",
        "/path/to/your/vault"
      ]
    }
  }
}
```

To connect multiple vaults, add a separate entry per vault:

```json
{
  "mcpServers": {
    "obsidian-work": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp-server/build/index.js", "/path/to/work-vault"]
    },
    "obsidian-personal": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp-server/build/index.js", "/path/to/personal-vault"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Cursor

Go to `Cursor Settings` (⌘⇧J) → MCP tab → add a new server with this command:

```bash
node /absolute/path/to/obsidian-mcp-server/build/index.js /path/to/your/vault
```

## Development

```bash
npm test        # run tests
npm run coverage  # run tests with coverage report
npm run build   # compile TypeScript
```

## Comparison with Other Solutions

While this implementation is intentionally lightweight, other solutions like [jacksteamdev/obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools) offer a more feature-rich approach as an Obsidian plugin.

This standalone server has the advantage of direct filesystem access without requiring the Obsidian application to be running.

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
