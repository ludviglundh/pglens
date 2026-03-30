import { Hono } from "hono";
import {
  listSchemas,
  listTables,
  getColumns,
  getIndexes,
  getReferences,
  listEnums,
} from "../services/database.js";

export function schemaRoutes() {
  const app = new Hono();

  app.get("/schemas", async (c) => {
    return c.json(await listSchemas());
  });

  app.get("/:schema/tables", async (c) => {
    return c.json(await listTables(c.req.param("schema")));
  });

  app.get("/:schema/:table/columns", async (c) => {
    return c.json(
      await getColumns(c.req.param("schema"), c.req.param("table"))
    );
  });

  app.get("/:schema/:table/indexes", async (c) => {
    return c.json(
      await getIndexes(c.req.param("schema"), c.req.param("table"))
    );
  });

  app.get("/:schema/:table/references", async (c) => {
    return c.json(
      await getReferences(c.req.param("schema"), c.req.param("table"))
    );
  });

  app.get("/:schema/enums", async (c) => {
    return c.json(await listEnums(c.req.param("schema")));
  });

  return app;
}
