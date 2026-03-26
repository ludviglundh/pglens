// In Tauri, frontend is served from filesystem, so API calls need the full URL.
// In browser/npx mode, relative /api works via Vite proxy or Hono serving both.
const isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
const BASE = isTauri ? "http://localhost:4985/api" : "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export interface SchemaInfo {
  schema_name: string;
}

export interface TableInfo {
  name: string;
  type: "table" | "view";
  comment: string | null;
  column_count: number;
  row_count: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
  foreign_key: {
    table: string;
    schema: string;
    column: string;
  } | null;
}

export interface IndexInfo {
  name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
}

export interface ReferenceInfo {
  constraint_name: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_column: string;
}

export interface EnumInfo {
  name: string;
  values: string[];
}

export interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

export const FILTER_OPERATORS = [
  { value: "eq", label: "equals", badge: "=" },
  { value: "neq", label: "not equals", badge: "<>" },
  { value: "gt", label: "greater", badge: ">" },
  { value: "gte", label: "greater or equals", badge: ">=" },
  { value: "lt", label: "less", badge: "<" },
  { value: "lte", label: "less or equals", badge: "<=" },
  { value: "like", label: "like", badge: "LIKE" },
  { value: "ilike", label: "ilike", badge: "ILIKE" },
  { value: "not_like", label: "not like", badge: "NOT LIKE" },
  { value: "in", label: "in", badge: "IN" },
  { value: "is_null", label: "is null", badge: "IS NULL" },
  { value: "is_not_null", label: "is not null", badge: "IS NOT NULL" },
] as const;

export interface RowsResponse {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: { name: string }[];
  count: number;
}

export const api = {
  connection: {
    connect: (connectionString: string) =>
      request<{ ok: boolean }>("/connection/connect", {
        method: "POST",
        body: JSON.stringify({ connectionString }),
      }),
    disconnect: () =>
      request<{ ok: boolean }>("/connection/disconnect", { method: "POST" }),
    status: () => request<{ connected: boolean }>("/connection/status"),
  },
  schema: {
    list: () => request<SchemaInfo[]>("/schema/schemas"),
    tables: (schema: string) =>
      request<TableInfo[]>(`/schema/${schema}/tables`),
    columns: (schema: string, table: string) =>
      request<ColumnInfo[]>(`/schema/${schema}/${table}/columns`),
    indexes: (schema: string, table: string) =>
      request<IndexInfo[]>(`/schema/${schema}/${table}/indexes`),
    references: (schema: string, table: string) =>
      request<ReferenceInfo[]>(`/schema/${schema}/${table}/references`),
    enums: (schema: string) =>
      request<EnumInfo[]>(`/schema/${schema}/enums`),
  },
  data: {
    rows: (
      schema: string,
      table: string,
      params: {
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        search?: string;
        filters?: FilterCondition[];
      } = {}
    ) => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params.sortBy) qs.set("sortBy", params.sortBy);
      if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
      if (params.search) qs.set("search", params.search);
      if (params.filters && params.filters.length > 0) qs.set("filters", JSON.stringify(params.filters));
      return request<RowsResponse>(`/data/${schema}/${table}/rows?${qs}`);
    },
    query: (sql: string) =>
      request<QueryResult>("/data/query", {
        method: "POST",
        body: JSON.stringify({ sql }),
      }),
    update: (schema: string, table: string, changes: unknown[]) =>
      request<{ ok: boolean; affected: number }>(`/data/${schema}/${table}/update`, {
        method: "POST",
        body: JSON.stringify({ changes }),
      }),
  },
};
