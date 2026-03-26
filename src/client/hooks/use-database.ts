import { useState, useEffect, useCallback } from "react";
import { api, type EnumInfo, type SchemaInfo, type TableInfo } from "@client/lib/api";

export interface SchemaTree {
  name: string;
  tables: TableInfo[];
  enums: EnumInfo[];
  expanded: boolean;
}

export function useDatabase() {
  const [schemas, setSchemas] = useState<SchemaTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchemas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const schemaList = await api.schema.list();
      const trees: SchemaTree[] = await Promise.all(
        schemaList.map(async (s) => {
          const [tables, enums] = await Promise.all([
            api.schema.tables(s.schema_name),
            api.schema.enums(s.schema_name),
          ]);
          return {
            name: s.schema_name,
            tables,
            enums,
            expanded: s.schema_name === "public",
          };
        })
      );
      setSchemas(trees);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  const toggleSchema = useCallback((schemaName: string) => {
    setSchemas((prev) =>
      prev.map((s) =>
        s.name === schemaName ? { ...s, expanded: !s.expanded } : s
      )
    );
  }, []);

  return { schemas, loading, error, toggleSchema, refresh: loadSchemas };
}
