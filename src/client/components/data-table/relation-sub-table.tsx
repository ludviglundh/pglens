import { Button } from "@client/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@client/components/ui/table";
import {
	type ColumnInfo,
	type ReferenceInfo,
	type RowsResponse,
	api,
} from "@client/lib/api";
import { Key, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface RelationSubTableProps {
	schema: string;
	table: string;
	filterColumn: string;
	filterValue: string;
	onNavigate: (schema: string, table: string) => void;
}

export function RelationSubTable({
	schema,
	table,
	filterColumn,
	filterValue,
	onNavigate,
}: RelationSubTableProps) {
	const [columns, setColumns] = useState<ColumnInfo[]>([]);
	const [data, setData] = useState<RowsResponse | null>(null);
	const [references, setReferences] = useState<ReferenceInfo[]>([]);
	const [loading, setLoading] = useState(true);

	const tableName = schema === "public" ? table : `${schema}.${table}`;

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [cols, rows, refs] = await Promise.all([
				api.schema.columns(schema, table),
				api.data.rows(schema, table, {
					page: 1,
					pageSize: 50,
					filters: [
						{ column: filterColumn, operator: "eq", value: filterValue },
					],
				}),
				api.schema.references(schema, table),
			]);
			setColumns(cols);
			setData(rows);
			setReferences(refs);
		} catch (err) {
			console.error("Failed to load sub table:", err);
		} finally {
			setLoading(false);
		}
	}, [schema, table, filterColumn, filterValue]);

	useEffect(() => {
		load();
	}, [load]);

	// Group reverse relations by source table
	const refsByTable = Object.entries(
		references.reduce(
			(acc, ref) => {
				const key = `${ref.source_schema}.${ref.source_table}`;
				if (!acc[key]) acc[key] = [];
				acc[key].push(ref);
				return acc;
			},
			{} as Record<string, ReferenceInfo[]>,
		),
	);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-6">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!data || data.rows.length === 0) {
		return (
			<div className="text-xs text-muted-foreground text-center py-4">
				No related rows found
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Sub table label */}
			<div className="inline-block border px-2.5 py-1 text-xs font-medium w-full">
				{tableName}
			</div>

			{/* Sub table */}
			<div className="overflow-x-auto border">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((col) => (
								<TableHead key={col.name} className="text-xs">
									<div className="flex items-center gap-1">
										{col.is_primary_key && (
											<Key className="size-3 text-amber-500 shrink-0" />
										)}
										<span>{col.name}</span>
										<span className="text-[10px] text-muted-foreground/60 font-normal">
											{col.type}
										</span>
									</div>
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.rows.map((row, rowIdx) => (
							<TableRow key={rowIdx}>
								{columns.map((col) => {
									const value = row[col.name];
									return (
										<TableCell
											key={col.name}
											className="text-xs truncate max-w-[250px]"
										>
											{value === null ? (
												<span className="text-muted-foreground/50 italic">
													NULL
												</span>
											) : typeof value === "object" ? (
												<span
													className="font-mono"
													title={JSON.stringify(value)}
												>
													{JSON.stringify(value).slice(0, 50)}...
												</span>
											) : (
												<span className="font-mono">{String(value)}</span>
											)}
										</TableCell>
									);
								})}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{data.total > data.rows.length && (
				<div className="text-xs text-muted-foreground">
					Showing {data.rows.length} of {data.total} rows
				</div>
			)}

			{/* Open in sub view / tab */}
			<Button
				variant="outline"
				size="sm"
				onClick={() => onNavigate(schema, table)}
			>
				Open in sub view
			</Button>

			{/* Reverse relation columns at the bottom */}
			{refsByTable.length > 0 && (
				<div className="flex items-center gap-1.5 flex-wrap pt-1">
					{refsByTable.map(([key, refs]) => {
						const ref = refs[0];
						const label =
							ref.source_schema === "public"
								? ref.source_table
								: `${ref.source_schema}.${ref.source_table}`;
						return (
							<Button
								key={key}
								variant="outline"
								size="xs"
								onClick={() => onNavigate(ref.source_schema, ref.source_table)}
							>
								{label}
							</Button>
						);
					})}
				</div>
			)}
		</div>
	);
}
