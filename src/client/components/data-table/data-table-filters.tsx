import { Button } from "@client/components/ui/button";
import { Input } from "@client/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import {
	type ColumnInfo,
	FILTER_OPERATORS,
	type FilterCondition,
} from "@client/lib/api";
import { Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "../ui/separator";

interface DataTableFiltersProps {
	columns: ColumnInfo[];
	search: string;
	onSearchChange: (search: string) => void;
	filters: FilterCondition[];
	onFiltersChange: (filters: FilterCondition[]) => void;
}

const NO_VALUE_OPS = ["is_null", "is_not_null"];

function isFilterComplete(f: FilterCondition): boolean {
	if (!f.column || !f.operator) return false;
	if (NO_VALUE_OPS.includes(f.operator)) return true;
	return f.value.trim().length > 0;
}

export function DataTableFilters({
	columns,
	search,
	onSearchChange,
	filters,
	onFiltersChange,
}: DataTableFiltersProps) {
	const [drafts, setDrafts] = useState<FilterCondition[]>(filters);

	// Sync drafts when applied filters change externally (e.g. clear)
	useEffect(() => {
		setDrafts(filters);
	}, [filters]);

	const isDirty = JSON.stringify(drafts) !== JSON.stringify(filters);

	const allComplete = drafts.every(isFilterComplete);
	const canApply = isDirty && allComplete;

	function addDraft() {
		const firstCol = columns[0]?.name ?? "";
		setDrafts([...drafts, { column: firstCol, operator: "eq", value: "" }]);
	}

	function updateDraft(index: number, patch: Partial<FilterCondition>) {
		setDrafts(drafts.map((f, i) => (i === index ? { ...f, ...patch } : f)));
	}

	function removeDraft(index: number) {
		const next = drafts.filter((_, i) => i !== index);
		setDrafts(next);
		// If removing brings us back to matching applied state, or no filters left, apply immediately
		if (next.length === 0) {
			onFiltersChange([]);
		}
	}

	function apply() {
		onFiltersChange(drafts);
	}

	function clearAll() {
		setDrafts([]);
		onFiltersChange([]);
		onSearchChange("");
	}

	if (drafts.length === 0) {
		return (
			<div className="flex items-center gap-2 border-b p-2">
				<Button
					variant="outline"
					size="sm"
					className="gap-1"
					onClick={addDraft}
				>
					<Plus className="size-3" />
					Add filter
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 border-b py-2">
			{drafts.map((f, i) => (
				<div key={i} className="flex items-center gap-1.5 px-3">
					<Button variant="ghost" size="icon-xs" onClick={() => removeDraft(i)}>
						<X className="size-3" />
					</Button>

					<span className="text-xs text-muted-foreground w-10 shrink-0">
						{i === 0 ? "where" : "and"}
					</span>

					<Select
						value={f.column}
						onValueChange={(v) => updateDraft(i, { column: v })}
					>
						<SelectTrigger size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{columns.map((col) => (
								<SelectItem key={col.name} value={col.name}>
									{col.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={f.operator}
						onValueChange={(v) => updateDraft(i, { operator: v })}
					>
						<SelectTrigger size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FILTER_OPERATORS.map((op) => (
								<SelectItem key={op.value} value={op.value}>
									<span className="flex items-center justify-between w-full gap-4">
										<span>{op.label}</span>
										<span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5">
											{op.badge}
										</span>
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{!NO_VALUE_OPS.includes(f.operator) && (
						<Input
							placeholder="Value"
							value={f.value}
							onChange={(e) => updateDraft(i, { value: e.target.value })}
							className="h-8"
							onKeyDown={(e) => {
								if (e.key === "Enter" && canApply) apply();
							}}
						/>
					)}
				</div>
			))}

			<Separator orientation="vertical" />

			<div className="flex items-center gap-2 px-3">
				{canApply && (
					<Button size="sm" className="gap-1" onClick={apply}>
						<Check className="size-3" />
						Apply
					</Button>
				)}
				<Button
					variant="outline"
					size="sm"
					className="gap-1"
					onClick={addDraft}
				>
					<Plus className="size-3" />
					Add filter
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={clearAll}
					className="text-muted-foreground"
				>
					Clear filters
				</Button>
			</div>
		</div>
	);
}
