import { useState, useEffect } from "react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { ConnectionPage } from "@client/components/connection/connection-page";
import { DatabaseLayout } from "@client/components/layout/database-layout";
import { api } from "@client/lib/api";
import { Toaster } from "@client/components/ui/sonner";
import { TooltipProvider } from "@client/components/ui/tooltip";

export function App() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.connection.status().then(({ connected }) => {
      setConnected(connected);
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
