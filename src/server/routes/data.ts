import { Hono } from "hono";
import { getDb } from "../db.js";

interface Filter {
  column: string;
  operator: string;
  value: string;
}

function buildWhereClause(db: ReturnType<typeof getDb>, filters: Filter[], search?: string, searchColumns?: string[]) {
  const conditions: ReturnType<typeof db>[] = [];

  for (const f of filters) {
    switch (f.operator) {
      case "eq":
        conditions.push(db`${db(f.column)} = ${f.value}`);
        break;
      case "neq":
        conditions.push(db`${db(f.column)} != ${f.value}`);
        break;
      case "gt":
        conditions.push(db`${db(f.column)} > ${f.value}`);
        break;
      case "gte":
        conditions.push(db`${db(f.column)} >= ${f.value}`);
        break;
      case "lt":
        conditions.push(db`${db(f.column)} < ${f.value}`);
        break;
      case "lte":
        conditions.push(db`${db(f.column)} <= ${f.value}`);
        break;
      case "like":
        conditions.push(db`${db(f.column)}::text LIKE ${"%" + f.value + "%"}`);
        break;
      case "ilike":
        conditions.push(db`${db(f.column)}::text ILIKE ${"%" + f.value + "%"}`);
        break;
      case "not_like":
        conditions.push(db`${db(f.column)}::text NOT LIKE ${"%" + f.value + "%"}`);
        break;
      case "is_null":
        conditions.push(db`${db(f.column)} IS NULL`);
        break;
      case "is_not_null":
        conditions.push(db`${db(f.column)} IS NOT NULL`);
        break;
      case "in": {
        const values = f.value.split(",").map((v) => v.trim());
        conditions.push(db`${db(f.column)}::text = ANY(${values})`);
        break;
      }
    }
  }

  if (search && searchColumns && searchColumns.length > 0) {
    const searchPattern = "%" + search + "%";
    const searchConds = searchColumns.map(
      (col) => db`${db(col)}::text ILIKE ${searchPattern}`
    );
    // OR all search conditions together
    let combined = searchConds[0];
    for (let i = 1; i < searchConds.length; i++) {
      combined = db`${combined} OR ${searchConds[i]}`;
    }
    conditions.push(db`(${combined})`);
  }

  if (conditions.length === 0) return db``;

  let where = conditions[0];
  for (let i = 1; i < conditions.length; i++) {
    where = db`${where} AND ${conditions[i]}`;
  }
  return db`WHERE ${where}`;
}

export function dataRoutes() {
  const app = new Hono();

  // Get table data with pagination, sorting, filtering
  app.get("/:schema/:table/rows", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "50", 10);
    const sortBy = c.req.query("sortBy");
    const sortOrder = c.req.query("sortOrder") === "desc" ? "DESC" : "ASC";
    const search = c.req.query("search");
    const filtersParam = c.req.query("filters");
    const offset = (page - 1) * pageSize;
    const db = getDb();

    let filters: Filter[] = [];
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {}
    }

    // Get text-like columns for search
    let searchColumns: string[] = [];
    if (search) {
      const cols = await db`
        SELECT a.attname AS name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ${schema}
          AND c.relname = ${table}
          AND a.attnum > 0
          AND NOT a.attisdropped
      `;
      searchColumns = cols.map((col) => col.name);
    }

    const whereClause = buildWhereClause(db, filters, search, searchColumns);

    // Get total count
    const [{ count }] = await db`
      SELECT count(*) AS count
      FROM ${db(schema)}.${db(table)}
      ${whereClause}
    `;

    // Get rows
    const rows = await db`
      SELECT *
      FROM ${db(schema)}.${db(table)}
      ${whereClause}
      ${sortBy ? db`ORDER BY ${db(sortBy)} ${db.unsafe(sortOrder)}` : db``}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return c.json({
      rows,
      total: Number(count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(count) / pageSize),
    });
  });

  // Execute raw SQL
  app.post("/query", async (c) => {
    const { sql } = await c.req.json();
    const db = getDb();

    try {
      const result = await db.unsafe(sql);
      return c.json({
        rows: result,
        columns: result.columns,
        count: result.count,
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400);
    }
  });

  // Update rows (batch)
  app.post("/:schema/:table/update", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const { changes } = await c.req.json();
    const db = getDb();

    const results = await db.begin(async (tx) => {
      const ops = [];
      for (const change of changes) {
        if (change.type === "update") {
          ops.push(
            tx`
              UPDATE ${tx(schema)}.${tx(table)}
              SET ${tx(change.data)}
              WHERE ${tx(change.where)}
            `
          );
        } else if (change.type === "insert") {
          ops.push(
            tx`
              INSERT INTO ${tx(schema)}.${tx(table)}
              ${tx(change.data)}
            `
          );
        } else if (change.type === "delete") {
          ops.push(
            tx`
              DELETE FROM ${tx(schema)}.${tx(table)}
              WHERE ${tx(change.where)}
            `
          );
        }
      }
      return Promise.all(ops);
    });

    return c.json({ ok: true, affected: results.length });
  });

  return app;
}
