import { Hono } from "hono";
import { connectionRoutes } from "./connection.js";
import { schemaRoutes } from "./schema.js";
import { dataRoutes } from "./data.js";

export function apiRoutes(initialConnectionString?: string) {
  const api = new Hono();

  api.route("/connection", connectionRoutes(initialConnectionString));
  api.route("/schema", schemaRoutes());
  api.route("/data", dataRoutes());

  return api;
}
