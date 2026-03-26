import { Hono } from "hono";
import { getDb, connect, disconnect, isConnected } from "../db.js";

export function connectionRoutes(initialConnectionString?: string) {
  const app = new Hono();

  // Connect to database
  app.post("/connect", async (c) => {
    const body = await c.req.json();
    const connectionString = body.connectionString as string;

    try {
      await connect(connectionString);
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { ok: false, error: (error as Error).message },
        400
      );
    }
  });

  // Disconnect
  app.post("/disconnect", async (c) => {
    await disconnect();
    return c.json({ ok: true });
  });

  // Connection status
  app.get("/status", (c) => {
    return c.json({ connected: isConnected() });
  });

  // Auto-connect if CLI connection string was provided
  if (initialConnectionString) {
    connect(initialConnectionString).catch(console.error);
  }

  return app;
}
