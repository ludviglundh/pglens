# PG Lens

A browser-based Postgres database explorer. Connect to any Postgres database and browse tables, edit data, run SQL queries, and navigate relations.

## Install

### Desktop App (macOS)

Download the latest `.dmg` from [Releases](https://github.com/ludviglundh/pglens/releases).

> Currently available for macOS (Apple Silicon). More platforms coming soon.

**Note:** The app is not signed with an Apple Developer certificate. On first launch macOS will block it. To open it:

1. Open **System Settings > Privacy & Security**
2. Scroll down and click **Open Anyway** next to the PG Lens message

Or run this in Terminal after installing:
```bash
xattr -cr "/Applications/PG Lens.app"
```

### CLI (npm)

```bash
npx @ludviglundh/pglens
```

Or with a connection string:

```bash
npx @ludviglundh/pglens postgres://user:pass@localhost:5432/mydb
```

No installation required. Starts a local server and opens the UI in your browser.

### CLI Options

```
pglens [connection-string] [options]

Options:
  -p, --port     Port to listen on (default: 4985)
  --host         Host to bind to (default: localhost)
  --no-open      Don't open browser automatically
  -h, --help     Show this help message
```

### MCP Server

PG Lens can run as an [MCP](https://modelcontextprotocol.io) server, giving AI assistants (Claude Code, Cursor, etc.) direct access to your PostgreSQL database.

```bash
pglens mcp postgres://user:pass@localhost:5432/mydb
```

By default the MCP server is **read-only**. To allow write operations:

```bash
pglens mcp postgres://user:pass@localhost:5432/mydb --read-write
```

The connection string can also be provided via the `DATABASE_URL` environment variable.

#### Claude Code

```bash
claude mcp add pglens -s user -- npx -y @ludviglundh/pglens mcp postgres://user:pass@localhost:5432/mydb
```

For read-write mode:

```bash
claude mcp add pglens -s user -- npx -y @ludviglundh/pglens mcp --read-write postgres://user:pass@localhost:5432/mydb
```

Or add manually to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "pglens": {
      "command": "npx",
      "args": ["-y", "@ludviglundh/pglens", "mcp", "postgres://user:pass@localhost:5432/mydb"]
    }
  }
}
```

#### Claude Desktop / Cursor

Add to your MCP config file:

```json
{
  "mcpServers": {
    "pglens": {
      "command": "npx",
      "args": ["@ludviglundh/pglens", "mcp", "postgres://user:pass@localhost:5432/mydb"]
    }
  }
}
```

#### Available Tools

| Tool | Description |
|------|-------------|
| `list_schemas` | List all database schemas |
| `list_tables` | Tables and views in a schema with row counts |
| `describe_table` | Columns, indexes, and foreign key references |
| `get_rows` | Paginated rows with sorting, filtering, and search |
| `list_enums` | Enum types and their values |
| `query` | Execute SQL (read-only by default) |
| `execute_mutation` | Batch INSERT/UPDATE/DELETE (requires `--read-write`) |

A `postgres://schema` resource is also available, providing a full database schema overview.

## Features

### Schema Browser
- Schema selector with table search and filter
- Tables and views with row counts
- Enum types with values (toggleable)

### Data Browser
- Paginated table with configurable page size (25/50/100/250)
- Column sorting and resizing
- Type-aware cell rendering (timestamps, UUIDs, booleans, enums, JSON, binary, NULL)
- Inline sub-tables for FK and reverse relation navigation
- CSV and JSON export

### Filtering
- Inline filter builder with operators: =, <>, >, >=, <, <=, LIKE, ILIKE, NOT LIKE, IN, IS NULL, IS NOT NULL
- Draft-then-apply workflow

### CRUD
- Double-click cells to edit via type-specific popover editors
- Inline select for booleans and enums
- Date picker with calendar and time scrollers for timestamps
- Batch mode: stage edits, inserts, and deletes, then review and save
- Add rows via dialog, delete via checkboxes

### SQL Editor
- CodeMirror 6 with PostgreSQL syntax highlighting
- Run full query or selected text (Ctrl/Cmd+Enter)
- Export results as CSV or JSON
- Destructive statement warnings

### Other
- Dark mode with system detection
- URL state persistence (tabs, pagination survive refresh)
- Collapsible sidebar with settings menu

## Security

- Binds to `localhost` only by default
- Use `--host 0.0.0.0` to expose to the network (auto-generates auth token)
- Destructive SQL operations require confirmation

## Tech Stack

- **Backend:** Hono + Node.js
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Database:** postgres.js + pg_catalog introspection
- **Table:** TanStack React Table
- **SQL Editor:** CodeMirror 6
- **Desktop:** Tauri v2
- **URL State:** nuqs

## Development

```bash
# Install dependencies
bun install

# Start dev server (backend + frontend with hot reload)
bun run dev

# Build for production (npm)
bun run build

# Build desktop app (macOS .dmg)
bun run tauri:build

# Type check
bun run typecheck
```

## License

[MIT](LICENSE)
