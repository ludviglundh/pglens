import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export async function connect(connectionString: string) {
  if (sql) {
    await sql.end();
  }

  sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  // Test the connection
  await sql`SELECT 1`;
}

export async function disconnect() {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

export function getDb() {
  if (!sql) {
    throw new Error("Not connected to a database");
  }
  return sql;
}

export function isConnected() {
  return sql !== null;
}
