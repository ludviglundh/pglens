import { parseArgs } from "node:util";
import { startServer } from "./server.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p", default: "4985" },
    host: { type: "string", default: "localhost" },
    "no-open": { type: "boolean", default: false },
    "read-write": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

const subcommand = positionals[0];

if (subcommand === "mcp") {
  const connectionString = positionals[1] || process.env.DATABASE_URL;

  if (values.help || !connectionString) {
    console.log(`
  pglens mcp - MCP server for PostgreSQL

  Usage:
    pglens mcp <connection-string> [options]
    pglens mcp --help

  The connection string can also be provided via the DATABASE_URL
  environment variable.

  Options:
    --read-write   Allow write operations (default: read-only)
    -h, --help     Show this help message

  Examples:
    pglens mcp postgres://user:pass@localhost:5432/mydb
    pglens mcp postgres://user:pass@localhost:5432/mydb --read-write
`);
    process.exit(connectionString ? 0 : 1);
  }

  const { startMcp } = await import("./mcp.js");
  startMcp({
    connectionString,
    readWrite: values["read-write"]!,
  });
} else {
  if (values.help) {
    console.log(`
  pglens - Browser-based Postgres explorer

  Usage:
    pglens [connection-string] [options]
    pglens mcp <connection-string> [options]

  Options:
    -p, --port     Port to listen on (default: 4985)
    --host         Host to bind to (default: localhost)
    --no-open      Don't open browser automatically
    -h, --help     Show this help message

  Subcommands:
    mcp            Start as an MCP server (stdio transport)

  Examples:
    pglens
    pglens postgres://user:pass@localhost:5432/mydb
    pglens --port 3000 --no-open
    pglens mcp postgres://user:pass@localhost:5432/mydb
`);
    process.exit(0);
  }

  const connectionString = positionals[0] || undefined;
  const port = parseInt(values.port!, 10);
  const host = values.host!;
  const open = !values["no-open"];

  startServer({ connectionString, port, host, open });
}
