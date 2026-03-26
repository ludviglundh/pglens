export interface SavedConnection {
  id: string;
  name: string;
  connectionString: string;
  createdAt: number;
}

const STORAGE_KEY = "pglens:connections";

export function getSavedConnections(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConnection(conn: Omit<SavedConnection, "id" | "createdAt">): SavedConnection {
  const connections = getSavedConnections();
  const saved: SavedConnection = {
    ...conn,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  connections.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections.slice(0, 20)));
  return saved;
}

export function removeConnection(id: string) {
  const connections = getSavedConnections().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

export function maskPassword(connectionString: string): string {
  return connectionString.replace(/:([^@/]+)@/, ":***@");
}
