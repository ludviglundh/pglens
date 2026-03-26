import { useState } from "react";
import { Button } from "@client/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@client/components/ui/dialog";
import { Input } from "@client/components/ui/input";
import { Label } from "@client/components/ui/label";
import { ScrollArea } from "@client/components/ui/scroll-area";
import type { ColumnInfo } from "@client/lib/api";
import { Plus } from "lucide-react";

interface AddRowDialogProps {
	columns: ColumnInfo[];
	onAdd: (data: Record<string, unknown>) => void;
}

export function AddRowDialog({ columns, onAdd }: AddRowDialogProps) {
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState<Record<string, string>>({});

	function handleOpen(isOpen: boolean) {
		setOpen(isOpen);
		if (isOpen) setValues({});
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const data: Record<string, unknown> = {};
		for (const col of columns) {
			const val = values[col.name];
			if (val === undefined || val === "") {
				if (col.default_value || col.nullable) continue;
			}
			if (val === "") continue;
			data[col.name] = val;
		}
		onAdd(data);
		setOpen(false);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-1">
					<Plus className="size-3" />
					Add row
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg flex flex-col max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>Add row</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
					<ScrollArea className="flex-1 min-h-0 pr-4">
						<div className="space-y-3 py-2">
							{columns.map((col) => (
								<div key={col.name} className="space-y-1">
									<Label htmlFor={`add-${col.name}`} className="text-xs">
										<span>{col.name}</span>
										<span className="text-muted-foreground/60 ml-1.5 font-normal">
											{col.type}
										</span>
										{col.nullable && (
											<span className="text-muted-foreground/40 ml-1 font-normal">
												nullable
											</span>
										)}
										{col.is_primary_key && (
											<span className="text-amber-500 ml-1 font-normal">
												PK
											</span>
										)}
									</Label>
									<Input
										id={`add-${col.name}`}
										placeholder={col.default_value ?? (col.nullable ? "NULL" : "")}
										value={values[col.name] ?? ""}
										onChange={(e) =>
											setValues((prev) => ({
												...prev,
												[col.name]: e.target.value,
											}))
										}
										className="h-8 text-xs font-mono"
									/>
								</div>
							))}
						</div>
					</ScrollArea>
					<DialogFooter className="mt-4 shrink-0 border-t pt-4">
						<Button type="submit" size="sm">
							Add row
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
