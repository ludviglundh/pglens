import { Hono } from "hono";
import { getDb } from "../db.js";

export function schemaRoutes() {
  const app = new Hono();

  // List all schemas
  app.get("/schemas", async (c) => {
    const db = getDb();
    const schemas = await db`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;
    return c.json(schemas);
  });

  // List tables and views for a schema
  app.get("/:schema/tables", async (c) => {
    const schema = c.req.param("schema");
    const db = getDb();

    const tables = await db`
      SELECT
        c.relname AS name,
        CASE c.relkind
          WHEN 'r' THEN 'table'
          WHEN 'v' THEN 'view'
        END AS type,
        obj_description(c.oid) AS comment,
        (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schema}
        AND c.relkind IN ('r', 'v')
      ORDER BY c.relkind, c.relname
    `;

    // Get actual row counts in parallel
    const withCounts = await Promise.all(
      tables.map(async (t) => {
        try {
          const [{ count }] = await db`SELECT count(*) AS count FROM ${db(schema)}.${db(t.name)}`;
          return { ...t, row_count: Number(count) };
        } catch {
          return { ...t, row_count: 0 };
        }
      })
    );

    return c.json(withCounts);
  });

  // Get columns for a table
  app.get("/:schema/:table/columns", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const db = getDb();

    const columns = await db`
      SELECT
        a.attname AS name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        NOT a.attnotnull AS nullable,
        pg_get_expr(d.adbin, d.adrelid) AS default_value,
        EXISTS (
          SELECT 1 FROM pg_constraint con
          WHERE con.conrelid = a.attrelid
            AND a.attnum = ANY(con.conkey)
            AND con.contype = 'p'
        ) AS is_primary_key,
        fk.foreign_key
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      LEFT JOIN LATERAL (
        SELECT json_build_object(
          'table', ref_cl.relname,
          'schema', ref_ns.nspname,
          'column', ref_att.attname
        ) AS foreign_key
        FROM pg_constraint con
        JOIN pg_class ref_cl ON ref_cl.oid = con.confrelid
        JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cl.relnamespace
        JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid
          AND ref_att.attnum = con.confkey[array_position(con.conkey, a.attnum)]
        WHERE con.conrelid = a.attrelid
          AND a.attnum = ANY(con.conkey)
          AND con.contype = 'f'
        LIMIT 1
      ) fk ON true
      WHERE n.nspname = ${schema}
        AND c.relname = ${table}
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `;

    return c.json(columns);
  });

  // Get indexes for a table
  app.get("/:schema/:table/indexes", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const db = getDb();

    const indexes = await db`
      SELECT
        i.relname AS name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        array_agg(a.attname ORDER BY x.n) AS columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, n)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
      WHERE n.nspname = ${schema}
        AND t.relname = ${table}
      GROUP BY i.relname, ix.indisunique, ix.indisprimary
      ORDER BY i.relname
    `;

    return c.json(indexes);
  });

  // Get foreign keys referencing this table (reverse relations)
  app.get("/:schema/:table/references", async (c) => {
    const schema = c.req.param("schema");
    const table = c.req.param("table");
    const db = getDb();

    const references = await db`
      SELECT
        con.conname AS constraint_name,
        src_ns.nspname AS source_schema,
        src_cl.relname AS source_table,
        src_att.attname AS source_column,
        ref_att.attname AS target_column
      FROM pg_constraint con
      JOIN pg_class ref_cl ON ref_cl.oid = con.confrelid
      JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cl.relnamespace
      JOIN pg_class src_cl ON src_cl.oid = con.conrelid
      JOIN pg_namespace src_ns ON src_ns.oid = src_cl.relnamespace
      JOIN pg_attribute src_att ON src_att.attrelid = con.conrelid AND src_att.attnum = con.conkey[1]
      JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
      WHERE ref_ns.nspname = ${schema}
        AND ref_cl.relname = ${table}
        AND con.contype = 'f'
      ORDER BY src_cl.relname
    `;

    return c.json(references);
  });

  // Get enums
  app.get("/:schema/enums", async (c) => {
    const schema = c.req.param("schema");
    const db = getDb();

    const enums = await db`
      SELECT
        t.typname AS name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema}
      GROUP BY t.typname
      ORDER BY t.typname
    `;

    return c.json(enums);
  });

  return app;
}
