import type postgres from "postgres";
import { getDb } from "../db.js";

type Sql = ReturnType<typeof getDb>;
type TxSql = postgres.TransactionSql<{}>;

// ─── Types ───────────────────────────────────────────────────────────

export interface Filter {
  column: string;
  operator: string;
  value: string;
}

export interface GetRowsParams {
  schema: string;
  table: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filters?: Filter[];
}

export interface Change {
  type: "update" | "insert" | "delete";
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildWhereClause(
  db: ReturnType<typeof getDb>,
  filters: Filter[],
  search?: string,
  searchColumns?: string[]
) {
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
        conditions.push(
          db`${db(f.column)}::text LIKE ${"%" + f.value + "%"}`
        );
        break;
      case "ilike":
        conditions.push(
          db`${db(f.column)}::text ILIKE ${"%" + f.value + "%"}`
        );
        break;
      case "not_like":
        conditions.push(
          db`${db(f.column)}::text NOT LIKE ${"%" + f.value + "%"}`
        );
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

// ─── Schema Functions ────────────────────────────────────────────────

export async function listSchemas() {
  const db = getDb();
  return db`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `;
}

interface TableRow {
  name: string;
  type: string;
  comment: string | null;
  column_count: number;
}

export async function listTables(schema: string) {
  const db = getDb();

  const tables: TableRow[] = await db`
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

  const withCounts = await Promise.all(
    tables.map(async (t) => {
      try {
        const [{ count }] =
          await db`SELECT count(*) AS count FROM ${db(schema)}.${db(t.name)}`;
        return { ...t, row_count: Number(count) };
      } catch {
        return { ...t, row_count: 0 };
      }
    })
  );

  return withCounts;
}

export async function getColumns(schema: string, table: string) {
  const db = getDb();
  return db`
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
}

export async function getIndexes(schema: string, table: string) {
  const db = getDb();
  return db`
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
}

export async function getReferences(schema: string, table: string) {
  const db = getDb();
  return db`
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
}

export async function listEnums(schema: string) {
  const db = getDb();
  return db`
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
}

// ─── Data Functions ──────────────────────────────────────────────────

export async function getRows(params: GetRowsParams) {
  const {
    schema,
    table,
    page = 1,
    pageSize = 50,
    sortBy,
    sortOrder = "asc",
    search,
    filters = [],
  } = params;

  const db = getDb();
  const offset = (page - 1) * pageSize;
  const order = sortOrder === "desc" ? "DESC" : "ASC";

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

  const [{ count }] = await db`
    SELECT count(*) AS count
    FROM ${db(schema)}.${db(table)}
    ${whereClause}
  `;

  const rows = await db`
    SELECT *
    FROM ${db(schema)}.${db(table)}
    ${whereClause}
    ${sortBy ? db`ORDER BY ${db(sortBy)} ${db.unsafe(order)}` : db``}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  return {
    rows,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  };
}

export async function executeQuery(sql: string) {
  const db = getDb();
  const result = await db.unsafe(sql);
  return {
    rows: result,
    columns: result.columns,
    count: result.count,
  };
}

export async function executeReadOnlyQuery(sql: string) {
  const db = getDb();
  const result = await db.begin("READ ONLY" as any, async (tx: any) => {
    return tx.unsafe(sql);
  });
  return {
    rows: result,
    columns: result.columns,
    count: result.count,
  };
}

export async function executeMutation(
  schema: string,
  table: string,
  changes: Change[]
) {
  const db = getDb();
  const results = await db.begin(async (_tx) => {
    const tx = _tx as unknown as Sql;
    const ops = [];
    for (const change of changes) {
      if (change.type === "update") {
        ops.push(
          tx`
            UPDATE ${tx(schema)}.${tx(table)}
            SET ${tx(change.data!)}
            WHERE ${tx(change.where!)}
          `
        );
      } else if (change.type === "insert") {
        if (!change.data || Object.keys(change.data).length === 0) {
          ops.push(
            tx`INSERT INTO ${tx(schema)}.${tx(table)} DEFAULT VALUES`
          );
        } else {
          ops.push(
            tx`
              INSERT INTO ${tx(schema)}.${tx(table)}
              ${tx(change.data)}
            `
          );
        }
      } else if (change.type === "delete") {
        ops.push(
          tx`
            DELETE FROM ${tx(schema)}.${tx(table)}
            WHERE ${tx(change.where!)}
          `
        );
      }
    }
    return Promise.all(ops);
  });

  return { ok: true, affected: results.length };
}
