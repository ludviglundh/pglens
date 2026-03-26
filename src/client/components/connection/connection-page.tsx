import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@client/components/ui/card";
import { api } from "@client/lib/api";
import {
	type SavedConnection,
	getSavedConnections,
	saveConnection,
} from "@client/lib/storage";
import { useCallback, useState } from "react";
import { ConnectionForm } from "./connection-form";
import { SavedConnections } from "./saved-connections";

interface ConnectionPageProps {
	onConnected: (connectionString: string) => void;
}

export function ConnectionPage({ onConnected }: ConnectionPageProps) {
	const [error, setError] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [savedConnections, setSavedConnections] = useState<SavedConnection[]>(
		() => getSavedConnections(),
	);

	const handleConnect = useCallback(
		async (connectionString: string, name?: string) => {
			setError(null);
			setIsConnecting(true);
			try {
				await api.connection.connect(connectionString);
				if (name) {
					saveConnection({ name, connectionString });
				}
				onConnected(connectionString);
			} catch (err) {
				setError((err as Error).message);
			} finally {
				setIsConnecting(false);
			}
		},
		[onConnected],
	);

	const handleSelectSaved = useCallback(
		(connectionString: string) => {
			handleConnect(connectionString);
		},
		[handleConnect],
	);

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center space-y-2">
					<h1
						className="text-2xl font-bold tracking-tight"
						style={{ fontFamily: "'Pixelify Sans', sans-serif" }}
					>
						pglens
					</h1>
					<p className="text-sm text-muted-foreground">
						Connect to any Postgres database
					</p>
				</div>

				<Card>
					<CardHeader className="pb-4">
						<CardTitle className="text-base">New connection</CardTitle>
						<CardDescription>
							Enter a connection string or fill in the fields below
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<ConnectionForm
							onConnect={handleConnect}
							isConnecting={isConnecting}
						/>
						{error && (
							<div className="border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{error}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<SavedConnections
							connections={savedConnections}
							onSelect={handleSelectSaved}
							onRemoved={() => setSavedConnections(getSavedConnections())}
						/>
						{savedConnections.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-2">
								No saved connections yet
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
