import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connect, disconnect } from "./db.js";
import {
  listSchemas,
  listTables,
  getColumns,
  getIndexes,
  getReferences,
  listEnums,
  getRows,
  executeReadOnlyQuery,
  executeQuery,
  executeMutation,
  type Change,
} from "./services/database.js";

export interface McpOptions {
  connectionString: string;
  readWrite: boolean;
}

function jsonContent(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function errorContent(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

export async function startMcp(options: McpOptions) {
  await connect(options.connectionString);

  const server = new McpServer({
    name: "pglens",
    version: "1.2.0",
  });

  // ─── Tools ───────────────────────────────────────────────────────

  server.tool("list_schemas", "List all database schemas", {}, async () => {
    try {
      return jsonContent(await listSchemas());
    } catch (e) {
      return errorContent(e);
    }
  });

  server.tool(
    "list_tables",
    "List tables and views in a schema with row counts",
    { schema: z.string().describe("Schema name") },
    async ({ schema }) => {
      try {
        return jsonContent(await listTables(schema));
      } catch (e) {
        return errorContent(e);
      }
    }
  );

  server.tool(
    "describe_table",
    "Get columns, indexes, and foreign key references for a table",
    {
      schema: z.string().describe("Schema name"),
      table: z.string().describe("Table name"),
    },
    async ({ schema, table }) => {
      try {
        const [columns, indexes, references] = await Promise.all([
          getColumns(schema, table),
          getIndexes(schema, table),
          getReferences(schema, table),
        ]);
        return jsonContent({ columns, indexes, references });
      } catch (e) {
        return errorContent(e);
      }
    }
  );

  server.tool(
    "get_rows",
    "Get paginated rows from a table with optional sorting, filtering, and search",
    {
      schema: z.string().describe("Schema name"),
      table: z.string().describe("Table name"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z
        .number()
        .optional()
        .describe("Rows per page (default: 50)"),
      sortBy: z.string().optional().describe("Column to sort by"),
      sortOrder: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort direction (default: asc)"),
      search: z
        .string()
        .optional()
        .describe("Search text across all columns"),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum([
              "eq",
              "neq",
              "gt",
              "gte",
              "lt",
              "lte",
              "like",
              "ilike",
              "not_like",
              "is_null",
              "is_not_null",
              "in",
            ]),
            value: z.string(),
          })
        )
        .optional()
        .describe("Column filters"),
    },
    async (params) => {
      try {
        return jsonContent(await getRows(params));
      } catch (e) {
        return errorContent(e);
      }
    }
  );

  server.tool(
    "list_enums",
    "List enum types and their values in a schema",
    { schema: z.string().describe("Schema name") },
    async ({ schema }) => {
      try {
        return jsonContent(await listEnums(schema));
      } catch (e) {
        return errorContent(e);
      }
    }
  );

  server.tool(
    "query",
    options.readWrite
      ? "Execute a SQL query (read and write)"
      : "Execute a read-only SQL query",
    { sql: z.string().describe("SQL query to execute") },
    async ({ sql }) => {
      try {
        const result = options.readWrite
          ? await executeQuery(sql)
          : await executeReadOnlyQuery(sql);
        return jsonContent(result);
      } catch (e) {
        return errorContent(e);
      }
    }
  );

  if (options.readWrite) {
    server.tool(
      "execute_mutation",
      "Execute batch INSERT, UPDATE, or DELETE operations on a table",
      {
        schema: z.string().describe("Schema name"),
        table: z.string().describe("Table name"),
        changes: z
          .array(
            z.object({
              type: z.enum(["insert", "update", "delete"]),
              data: z
                .record(z.string(), z.unknown())
                .optional()
                .describe("Row data for insert/update"),
              where: z
                .record(z.string(), z.unknown())
                .optional()
                .describe("Where clause for update/delete"),
            })
          )
          .describe("Array of mutations to execute in a transaction"),
      },
      async ({ schema, table, changes }) => {
        try {
          return jsonContent(
            await executeMutation(schema, table, changes as Change[])
          );
        } catch (e) {
          return errorContent(e);
        }
      }
    );
  }

  // ─── Resources ───────────────────────────────────────────────────

  server.resource(
    "database-schema",
    "postgres://schema",
    {
      description:
        "Complete database schema overview: all schemas, tables, columns, and relationships",
    },
    async () => {
      const schemas = await listSchemas();
      const overview: Record<string, unknown> = {};

      for (const s of schemas) {
        const schemaName = s.schema_name as string;
        const tables = await listTables(schemaName);
        const tableDetails: Record<string, unknown> = {};

        for (const t of tables) {
          const tableName = t.name as string;
          const [columns, indexes] = await Promise.all([
            getColumns(schemaName, tableName),
            getIndexes(schemaName, tableName),
          ]);
          tableDetails[tableName] = {
            type: t.type,
            comment: t.comment,
            row_count: t.row_count,
            columns,
            indexes,
          };
        }

        overview[schemaName] = tableDetails;
      }

      return {
        contents: [
          {
            uri: "postgres://schema",
            mimeType: "application/json",
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    }
  );

  // ─── Start ───────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await disconnect();
    process.exit(0);
  });
}
