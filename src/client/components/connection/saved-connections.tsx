import { Button } from "@client/components/ui/button";
import { Separator } from "@client/components/ui/separator";
import {
	type SavedConnection,
	maskPassword,
	removeConnection,
} from "@client/lib/storage";

interface SavedConnectionsProps {
	connections: SavedConnection[];
	onSelect: (connectionString: string) => void;
	onRemoved: () => void;
}

export function SavedConnections({
	connections,
	onSelect,
	onRemoved,
}: SavedConnectionsProps) {
	if (connections.length === 0) return null;

	function handleRemove(e: React.MouseEvent, id: string) {
		e.stopPropagation();
		removeConnection(id);
		onRemoved();
	}

	return (
		<div className="space-y-3">
			<h3 className="text-sm font-medium text-muted-foreground">
				Saved connections
			</h3>
			<Separator />
			<div className="space-y-1">
				{connections.map((conn) => (
					<button
						key={conn.id}
						type="button"
						onClick={() => onSelect(conn.connectionString)}
						className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent group"
					>
						<div className="min-w-0">
							<div className="font-medium truncate">
								{conn.name || "Unnamed connection"}
							</div>
							<div className="text-xs text-muted-foreground font-mono truncate">
								{maskPassword(conn.connectionString)}
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon-xs"
							className="opacity-0 group-hover:opacity-100 shrink-0"
							onClick={(e) => handleRemove(e, conn.id)}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</Button>
					</button>
				))}
			</div>
		</div>
	);
}
