import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRoutes } from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerOptions {
  connectionString?: string;
  port: number;
  host: string;
  open: boolean;
}

export async function startServer(options: ServerOptions) {
  const app = new Hono();

  app.use("*", cors());

  // API routes
  app.route("/api", apiRoutes(options.connectionString));

  // Serve static frontend assets in production
  const clientDir = path.join(__dirname, "client");
  app.use("*", serveStatic({ root: clientDir }));

  // SPA fallback
  app.get("*", async (c) => {
    const html = await fs.promises.readFile(
      path.join(clientDir, "index.html"),
      "utf-8"
    );
    return c.html(html);
  });

  const isExposed = options.host !== "localhost" && options.host !== "127.0.0.1";
  let authToken: string | undefined;

  if (isExposed) {
    authToken = crypto.randomUUID();
    console.warn(
      `\n  ⚠ Server exposed to network. Auth token: ${authToken}\n`
    );
  }

  let actualPort = options.port;

  const tryListen = (port: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      try {
        serve(
          {
            fetch: app.fetch,
            port,
            hostname: options.host,
          },
          () => resolve(port)
        );
      } catch {
        if (port < options.port + 10) {
          resolve(tryListen(port + 1));
        } else {
          reject(new Error("Could not find an available port"));
        }
      }
    });
  };

  actualPort = await tryListen(options.port);

  const url = `http://${options.host}:${actualPort}`;

  console.log(`
  pglens v0.1.0

  ➜ UI:        ${url}${options.connectionString ? `\n  ➜ Database:  ${options.connectionString.replace(/\/\/.*:.*@/, "//***:***@")}` : ""}
  ➜ Press q to quit
`);

  if (options.open) {
    const { exec } = await import("node:child_process");
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${cmd} ${url}`);
  }

  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.on("data", (data) => {
    if (data.toString() === "q") {
      console.log("\n  Shutting down...\n");
      process.exit(0);
    }
  });
}
