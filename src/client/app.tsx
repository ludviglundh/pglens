import { useState, useEffect } from "react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { ConnectionPage } from "@client/components/connection/connection-page";
import { DatabaseLayout } from "@client/components/layout/database-layout";
import { api } from "@client/lib/api";
import { Toaster } from "@client/components/ui/sonner";
import { TooltipProvider } from "@client/components/ui/tooltip";

async function waitForServer(maxRetries = 30, interval = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { connected } = await api.connection.status();
      return connected;
    } catch {
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  return false;
}

export function App() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    waitForServer().then((isConnected) => {
      setConnected(isConnected);
    });
  }, []);

  if (connected === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Connecting...</div>
      </div>
    );
  }

  return (
    <NuqsAdapter>
      <TooltipProvider>
        {connected ? (
          <DatabaseLayout onDisconnected={() => setConnected(false)} />
        ) : (
          <ConnectionPage onConnected={() => setConnected(true)} />
        )}
        <Toaster />
      </TooltipProvider>
    </NuqsAdapter>
  );
}
