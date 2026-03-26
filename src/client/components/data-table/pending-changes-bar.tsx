import { Button } from "@client/components/ui/button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@client/components/ui/alert-dialog";
import { Check, Loader2, Undo2 } from "lucide-react";
import type { CellEdit, PendingDelete, PendingInsert } from "@client/hooks/use-pending-changes";

interface PendingChangesBarProps {
	edits: CellEdit[];
	inserts: PendingInsert[];
	deletes: PendingDelete[];
	saving: boolean;
	onSave: () => void;
	onDiscard: () => void;
}

export function PendingChangesBar({
	edits,
	inserts,
	deletes,
	saving,
	onSave,
	onDiscard,
}: PendingChangesBarProps) {
	const total = edits.length + inserts.length + deletes.length;
	if (total === 0) return null;

	const parts: string[] = [];
	if (edits.length > 0) parts.push(`${edits.length} edit${edits.length !== 1 ? "s" : ""}`);
	if (inserts.length > 0) parts.push(`${inserts.length} insert${inserts.length !== 1 ? "s" : ""}`);
	if (deletes.length > 0) parts.push(`${deletes.length} delete${deletes.length !== 1 ? "s" : ""}`);

	return (
		<div className="flex items-center justify-between px-4 h-10 border-t bg-primary/10 shrink-0">
			<span className="text-xs font-medium">
				{parts.join(", ")} pending
			</span>
			<div className="flex items-center gap-2">
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
							<Undo2 className="size-3" />
							Discard
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Discard changes?</AlertDialogTitle>
							<AlertDialogDescription>
								This will discard {total} pending change{total !== 1 ? "s" : ""}. This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={onDiscard}>Discard</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<Button size="sm" onClick={onSave} disabled={saving} className="gap-1">
					{saving ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<Check className="size-3" />
					)}
					Save changes
				</Button>
			</div>
		</div>
	);
}
