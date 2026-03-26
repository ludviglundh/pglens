# pglens

A browser-based Postgres database explorer. Connect to any Postgres database and browse tables, edit data, run SQL queries, and navigate relations — all from your browser.

## Quick Start

```bash
npx @ludviglundh/pglens
```

Or with a connection string:

```bash
npx @ludviglundh/pglens postgres://user:pass@localhost:5432/mydb
```

This starts a local server and opens the UI in your browser. No installation required.

## Features

### Schema Browser
- Sidebar with schema selector and table search/filter
- Tables and views with row counts
- Enum types with values

### Data Browser
- Paginated table view with configurable page size (25/50/100/250)
- Column sorting (click headers)
- Resizable columns with smart defaults based on data type
- Type-aware cell rendering:
  - Timestamps: `YYYY-MM-DD HH:mm:ss.SSS`
  - UUIDs: truncated with full value on hover
  - Booleans: inline select (TRUE/FALSE)
  - Enums: inline select with valid values
  - JSON/JSONB: truncated preview, full view in editor
  - NULL: dimmed italic indicator
  - Binary (bytea): `<binary N bytes>`

### Filtering
- Inline filter builder (Drizzle Studio-style)
- Operators: =, <>, >, >=, <, <=, LIKE, ILIKE, NOT LIKE, IN, IS NULL, IS NOT NULL
- Draft-then-apply workflow

### Relations
- Foreign key values as clickable buttons
- Reverse relations displayed as columns per referencing table
- Inline sub-tables that expand below the row
- Multiple sub-tables can be open simultaneously

### CRUD
- Double-click any cell to edit via popover
- Type-specific editors:
  - Text/varchar: text input
  - Numbers: number input
  - Booleans: select dropdown
  - Enums: select dropdown with valid values
  - Timestamps: date picker with calendar + time scrollers
  - JSON: textarea with formatted preview
- Batch mode: stage multiple edits, inserts, and deletes, then review and save
- Add rows via dialog with column types and defaults
- Delete rows via checkboxes with confirmation
- Set any value to NULL

### SQL Editor
- CodeMirror 6 with PostgreSQL syntax highlighting
- Run full query or selected text (Ctrl/Cmd+Enter)
- Results displayed in a table
- Export results as CSV or JSON
- Destructive statement warnings (DROP, TRUNCATE, DELETE without WHERE)

### Export
- CSV and JSON export from both table browser and SQL editor
- Exports respect active filters

### Other
- Dark mode with system detection
- URL state persistence (open tabs, active table, pagination survive refresh)
- Collapsible sidebar
- Settings menu (show/hide enums, theme selection, disconnect)

## CLI Options

```
Usage:
  pglens [connection-string] [options]

Options:
  -p, --port     Port to listen on (default: 4985)
  --host         Host to bind to (default: localhost)
  --no-open      Don't open browser automatically
  -h, --help     Show this help message
```

## Security

- Binds to `localhost` only by default
- Use `--host 0.0.0.0` to expose to the network (auto-generates an auth token)
- Connection passwords are masked in the UI and stored in localStorage
- Destructive SQL operations require confirmation

## Tech Stack

- **Backend:** Hono + Node.js (compatible with Bun)
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Database:** postgres.js (postgresjs) + pg_catalog introspection
- **Table:** TanStack React Table
- **SQL Editor:** CodeMirror 6
- **URL State:** nuqs

## Development

```bash
# Install dependencies
bun install

# Start dev server (backend + frontend with hot reload)
bun run dev

# Build for production
bun run build

# Type check
bun run typecheck
```

## License

MIT
