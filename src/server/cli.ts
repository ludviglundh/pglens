import { parseArgs } from "node:util";
import { startServer } from "./server.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p", default: "4985" },
    host: { type: "string", default: "localhost" },
    "no-open": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
  pg-lens - Browser-based Postgres explorer

  Usage:
    pg-lens [connection-string] [options]

  Options:
    -p, --port     Port to listen on (default: 4985)
    --host         Host to bind to (default: localhost)
    --no-open      Don't open browser automatically
    -h, --help     Show this help message

  Examples:
    pg-lens
    pg-lens postgres://user:pass@localhost:5432/mydb
    pg-lens --port 3000 --no-open
`);
  process.exit(0);
}

const connectionString = positionals[0] || undefined;
const port = parseInt(values.port!, 10);
const host = values.host!;
const open = !values["no-open"];

startServer({ connectionString, port, host, open });
