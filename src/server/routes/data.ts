import { Hono } from "hono";
import {
  getRows,
  executeQuery,
  executeMutation,
  type Filter,
} from "../services/database.js";

export function dataRoutes() {
  const app = new Hono();

  app.get("/:schema/:table/rows", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "50", 10);
    const sortBy = c.req.query("sortBy");
    const sortOrder =
      c.req.query("sortOrder") === "desc" ? ("desc" as const) : ("asc" as const);
    const search = c.req.query("search");
    const filtersParam = c.req.query("filters");

    let filters: Filter[] = [];
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {}
    }

    return c.json(
      await getRows({ schema, table, page, pageSize, sortBy, sortOrder, search, filters })
    );
  });

  app.post("/query", async (c) => {
    const { sql } = await c.req.json();
    try {
      return c.json(await executeQuery(sql));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  app.post("/:schema/:table/update", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const { changes } = await c.req.json();
    try {
      return c.json(await executeMutation(schema, table, changes));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  return app;
}
