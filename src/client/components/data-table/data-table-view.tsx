import { Button } from "@client/components/ui/button";
import { Checkbox } from "@client/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import { Separator } from "@client/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@client/components/ui/table";
import { usePendingChanges } from "@client/hooks/use-pending-changes";
import {
	type ColumnInfo,
	type FilterCondition,
	type ReferenceInfo,
	type RowsResponse,
	api,
} from "@client/lib/api";
import {
	type ColumnDef,
	type SortingState,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	Download,
	Key,
	Link2,
	Loader2,
} from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddRowDialog } from "./add-row-dialog";
import { CellEditor } from "./cell-editor";
import { DataTableFilters } from "./data-table-filters";
import { PendingChangesBar } from "./pending-changes-bar";
import { RelationSubTable } from "./relation-sub-table";

interface DataTableViewProps {
	schema: string;
	table: string;
	onNavigate: (schema: string, table: string) => void;
}

type Row = Record<string, unknown>;

export function DataTableView({
	schema,
	table,
	onNavigate,
}: DataTableViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [dbColumns, setDbColumns] = useState<ColumnInfo[]>([]);
	const [references, setReferences] = useState<ReferenceInfo[]>([]);
	const [enumValues, setEnumValues] = useState<Record<string, string[]>>({});
	const [data, setData] = useState<RowsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const [pageSize, setPageSize] = useQueryState(
		"pageSize",
		parseAsInteger.withDefault(50),
	);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterCondition[]>([]);
	const [saving, setSaving] = useState(false);
	const [editingCell, setEditingCell] = useState<{
		row: number;
		col: string;
	} | null>(null);
	const pending = usePendingChanges();

	// Track expanded sub-tables per row: Map<rowIndex, Array<{schema, table, column, value}>>
	const [expandedRows, setExpandedRows] = useState<
		Map<
			number,
			Array<{ schema: string; table: string; column: string; value: string }>
		>
	>(new Map());

	function toggleSubTable(
		rowIdx: number,
		targetSchema: string,
		targetTable: string,
		filterColumn: string,
		filterValue: string,
	) {
		setExpandedRows((prev) => {
			const next = new Map(prev);
			const existing = next.get(rowIdx) ?? [];
			const key = `${targetSchema}.${targetTable}.${filterColumn}`;
			const found = existing.findIndex(
				(e) => `${e.schema}.${e.table}.${e.column}` === key,
			);
			if (found >= 0) {
				const updated = existing.filter((_, i) => i !== found);
				if (updated.length === 0) next.delete(rowIdx);
				else next.set(rowIdx, updated);
			} else {
				next.set(rowIdx, [
					...existing,
					{
						schema: targetSchema,
						table: targetTable,
						column: filterColumn,
						value: filterValue,
					},
				]);
			}
			return next;
		});
	}

	const sortBy = sorting[0]?.id;
	const sortOrder = sorting[0]?.desc ? "desc" : "asc";

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const [cols, rows, refs, enums] = await Promise.all([
				api.schema.columns(schema, table),
				api.data.rows(schema, table, {
					page,
					pageSize,
					sortBy,
					sortOrder,
					search: search || undefined,
					filters: filters.length > 0 ? filters : undefined,
				}),
				api.schema.references(schema, table),
				api.schema.enums(schema),
			]);
			setDbColumns(cols);
			setData(rows);
			setReferences(refs);
			const enumMap: Record<string, string[]> = {};
			for (const e of enums) enumMap[e.name] = e.values;
			setEnumValues(enumMap);
		} catch (err) {
			console.error("Failed to load table data:", err);
		} finally {
			setLoading(false);
		}
	}, [schema, table, page, pageSize, sortBy, sortOrder, search, filters]);

	const pkColumns = useMemo(
		() => dbColumns.filter((c) => c.is_primary_key).map((c) => c.name),
		[dbColumns],
	);

	async function handleSave() {
		if (!data) return;
		setSaving(true);
		try {
			const changes = pending.buildChanges(data.rows, pkColumns);
			await api.data.rows(schema, table, {}); // validate connection
			await fetch(`/api/data/${schema}/${table}/update`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ changes }),
			});
			pending.discard();
			loadData();
		} catch (err) {
			console.error("Failed to save:", err);
		} finally {
			setSaving(false);
		}
	}

	function openEditor(rowIndex: number, colName: string) {
		setEditingCell({ row: rowIndex, col: colName });
	}

	function closeEditor() {
		setEditingCell(null);
	}

	function exportTable(format: "csv" | "json") {
		if (!data || !data.rows.length) return;
		const cols = dbColumns.map((c) => c.name);

		let content: string;
		let mimeType: string;
		let filename: string;

		if (format === "json") {
			content = JSON.stringify(data.rows, null, 2);
			mimeType = "application/json";
			filename = `${table}.json`;
		} else {
			const lines = [cols.join(",")];
			for (const row of data.rows) {
				lines.push(
					cols
						.map((col) => {
							const val = row[col];
							if (val === null || val === undefined) return "";
							const str =
								typeof val === "object" ? JSON.stringify(val) : String(val);
							return str.includes(",") ||
								str.includes('"') ||
								str.includes("\n")
								? `"${str.replace(/"/g, '""')}"`
								: str;
						})
						.join(","),
				);
			}
			content = lines.join("\n");
			mimeType = "text/csv";
			filename = `${table}.csv`;
		}

		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Group reverse relations by source table
	const refsByTable = useMemo(
		() =>
			Object.entries(
				references.reduce(
					(acc, ref) => {
						const key = `${ref.source_schema}.${ref.source_table}`;
						if (!acc[key]) acc[key] = [];
						acc[key].push(ref);
						return acc;
					},
					{} as Record<string, ReferenceInfo[]>,
				),
			),
		[references],
	);

	// Build TanStack column defs from DB columns + reverse relations
	const columns = useMemo<ColumnDef<Row>[]>(() => {
		const dataCols: ColumnDef<Row>[] = dbColumns.map((col) => {
			// Estimate width from header text: column name + type label + icons + padding
			const headerTextLen = col.name.length + col.type.length;
			const iconSpace =
				(col.is_primary_key ? 20 : 0) + (col.foreign_key ? 20 : 0);
			const estimatedHeaderWidth = headerTextLen * 7.5 + iconSpace + 50; // chars * avg char width + padding + sort icon
			const minForType =
				col.type === "uuid"
					? 140
					: col.type.includes("timestamp")
						? 200
						: col.type.includes("int") || col.type === "boolean"
							? 100
							: 150;
			return {
				id: col.name,
				accessorKey: col.name,
				size: Math.max(minForType, Math.min(estimatedHeaderWidth, 400)),
				minSize: 60,
				header: () => (
					<div className="flex items-center gap-1 w-full">
						{col.is_primary_key && (
							<Key className="size-3 text-amber-500 shrink-0" />
						)}
						<span>{col.name}</span>
						<span className="text-[10px] text-muted-foreground/60 font-normal">
							{col.type}
						</span>
					</div>
				),
				cell: ({ getValue, row: cellRow }) => {
					const originalValue = getValue();
					const edit = pending.getCellEdit(cellRow.index, col.name);
					const displayValue = edit ? edit.newValue : originalValue;
					const isEditing =
						editingCell?.row === cellRow.index && editingCell?.col === col.name;

					let isFKOpen = false;
					if (col.foreign_key) {
						const subs = expandedRows.get(cellRow.index) ?? [];
						isFKOpen = subs.some(
							(s) =>
								s.schema === col.foreign_key!.schema &&
								s.table === col.foreign_key!.table &&
								s.column === col.foreign_key!.column,
						);
					}

					// Check if this is an enum column
					const colType = col.type.toLowerCase();
					const enumVals =
						enumValues[colType] ??
						Object.entries(enumValues).find(
							([name]) => colType === name || colType.endsWith(`.${name}`),
						)?.[1];

					// Enum columns: render inline Select directly, no popover
					if (enumVals) {
						return (
							<div
								className={edit ? "bg-primary/10 -mx-2 px-2 -my-1 py-1" : ""}
							>
								<Select
									value={
										displayValue === null ? undefined : String(displayValue)
									}
									onValueChange={(v) => {
										pending.addEdit({
											rowIndex: cellRow.index,
											column: col.name,
											oldValue: originalValue,
											newValue: v,
										});
									}}
								>
									<SelectTrigger
										size="sm"
										className="h-6 text-xs font-mono border-none shadow-none bg-transparent px-0 w-full"
									>
										<SelectValue placeholder="NULL" />
									</SelectTrigger>
									<SelectContent>
										{enumVals.map((val) => (
											<SelectItem key={val} value={val}>
												{val}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						);
					}

					// Boolean columns: render inline Select
					if (col.type.toLowerCase() === "boolean") {
						return (
							<div
								className={edit ? "bg-primary/10 -mx-2 px-2 -my-1 py-1" : ""}
							>
								<Select
									value={
										displayValue === null ? undefined : String(displayValue)
									}
									onValueChange={(v) => {
										pending.addEdit({
											rowIndex: cellRow.index,
											column: col.name,
											oldValue: originalValue,
											newValue: v,
										});
									}}
								>
									<SelectTrigger
										size="sm"
										className="h-6 text-xs border-none shadow-none bg-transparent px-0 w-full"
									>
										<SelectValue placeholder="NULL" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">TRUE</SelectItem>
										<SelectItem value="false">FALSE</SelectItem>
									</SelectContent>
								</Select>
							</div>
						);
					}

					const cellContent = (
						<div className={edit ? "bg-primary/10 -mx-2 px-2 -my-1 py-1" : ""}>
							<CellValue
								value={displayValue}
								column={col}
								isFKOpen={isFKOpen}
								onNavigateFK={
									col.foreign_key
										? (value: string) =>
												toggleSubTable(
													cellRow.index,
													col.foreign_key!.schema,
													col.foreign_key!.table,
													col.foreign_key!.column,
													value,
												)
										: undefined
								}
							/>
						</div>
					);

					if (isEditing) {
						return (
							<CellEditor
								column={col}
								value={displayValue}
								enumOptions={enumValues}
								open={true}
								onOpenChange={(open) => {
									if (!open) closeEditor();
								}}
								onSave={(newValue) => {
									pending.addEdit({
										rowIndex: cellRow.index,
										column: col.name,
										oldValue: originalValue,
										newValue,
									});
									closeEditor();
								}}
								onCancel={closeEditor}
							>
								<div>{cellContent}</div>
							</CellEditor>
						);
					}

					return (
						<div onDoubleClick={() => openEditor(cellRow.index, col.name)}>
							{cellContent}
						</div>
					);
				},
				meta: { dbColumn: col },
			};
		});

		// Find PK column(s) for reverse relation lookups
		const pkCol = dbColumns.find((c) => c.is_primary_key);

		const refCols: ColumnDef<Row>[] = refsByTable.map(([key, refs]) => {
			const ref = refs[0];
			const label =
				ref.source_schema === "public"
					? ref.source_table
					: `${ref.source_schema}.${ref.source_table}`;
			return {
				id: `ref:${key}`,
				size: 140,
				minSize: 60,
				header: () => <span className="flex items-center gap-1">{label}</span>,
				cell: ({ row: cellRow }) => {
					const pkValue = pkCol
						? String(cellRow.original[pkCol.name] ?? "")
						: "";
					const subs = expandedRows.get(cellRow.index) ?? [];
					const isOpen = subs.some(
						(s) =>
							s.schema === ref.source_schema &&
							s.table === ref.source_table &&
							s.column === ref.source_column,
					);
					return (
						<Button
							variant={isOpen ? "default" : "secondary"}
							size="xs"
							className="hover:bg-primary hover:text-primary-foreground"
							onClick={() =>
								toggleSubTable(
									cellRow.index,
									ref.source_schema,
									ref.source_table,
									ref.source_column,
									pkValue,
								)
							}
						>
							{label}
						</Button>
					);
				},
				enableSorting: false,
			};
		});

		const selectCol: ColumnDef<Row> = {
			id: "_select",
			size: 40,
			minSize: 40,
			enableSorting: false,
			header: () => null,
			cell: ({ row: cellRow }) => {
				const isDeleted = pending.isRowDeleted(cellRow.index);
				const pkValues: Record<string, unknown> = {};
				for (const pk of pkColumns) pkValues[pk] = cellRow.original[pk];
				return (
					<Checkbox
						checked={isDeleted}
						onCheckedChange={() => pending.addDelete(cellRow.index, pkValues)}
					/>
				);
			},
		};

		return [selectCol, ...dataCols, ...refCols];
	}, [
		dbColumns,
		refsByTable,
		onNavigate,
		toggleSubTable,
		expandedRows,
		pending,
		pkColumns,
		editingCell,
	]);

	const reactTable = useReactTable({
		data: data?.rows ?? [],
		columns,
		state: { sorting },
		onSortingChange: (updater) => {
			setSorting(updater);
			setPage(1);
		},
		getCoreRowModel: getCoreRowModel(),
		manualSorting: true,
		manualPagination: true,
		pageCount: data?.totalPages ?? 0,
		enableColumnResizing: true,
		columnResizeMode: "onChange",
	});

	if (loading && !data) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!data) return null;

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Table header info */}
			<div className="flex items-center justify-between px-4 h-10 border-b bg-muted/30 shrink-0">
				<div className="flex items-center gap-2 text-sm">
					<span className="font-medium">
						{schema === "public" ? table : `${schema}.${table}`}
					</span>
					<span className="text-muted-foreground">
						{data.total.toLocaleString()} rows
					</span>
					<AddRowDialog
						columns={dbColumns}
						onAdd={(rowData) => pending.addInsert(rowData)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="gap-1"
						onClick={() => exportTable("csv")}
					>
						<Download className="size-3" />
						CSV
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="gap-1"
						onClick={() => exportTable("json")}
					>
						<Download className="size-3" />
						JSON
					</Button>
					<Separator orientation="vertical" className="h-5" />
					<Select
						value={String(pageSize)}
						onValueChange={(v) => {
							setPageSize(Number(v));
							setPage(1);
						}}
					>
						<SelectTrigger size="sm" className="w-[70px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[25, 50, 100, 250].map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Filters */}
			<DataTableFilters
				columns={dbColumns}
				search={search}
				onSearchChange={(v) => {
					setSearch(v);
					setPage(1);
				}}
				filters={filters}
				onFiltersChange={(f) => {
					setFilters(f);
					setPage(1);
				}}
			/>

			{/* Scrollable table */}
			<div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
				<Table
					className="w-auto"
					style={{
						width: reactTable.getCenterTotalSize(),
						tableLayout: "fixed",
					}}
				>
					<TableHeader className="sticky top-0 bg-background z-10">
						{reactTable.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="relative group/header select-none border-r last:border-r-0"
										style={{ width: header.getSize() }}
									>
										{header.column.getCanSort() ? (
											<Button
												variant="ghost"
												size="xs"
												type="button"
												onClick={header.column.getToggleSortingHandler()}
												className="w-full"
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{{
													asc: <ArrowUp className="size-3" />,
													desc: <ArrowDown className="size-3" />,
												}[header.column.getIsSorted() as string] ?? (
													<ArrowUpDown className="size-3 opacity-30" />
												)}
											</Button>
										) : (
											<span className="text-muted-foreground text-xs">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</span>
										)}
										<div
											onMouseDown={header.getResizeHandler()}
											onTouchStart={header.getResizeHandler()}
											onDoubleClick={() => header.column.resetSize()}
											className="absolute -right-[5px] top-0 h-full w-[10px] cursor-col-resize select-none touch-none z-10"
										>
											<div className="mx-auto h-full w-[2px]" />
										</div>
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{reactTable.getRowModel().rows.map((row) => {
							const subs = expandedRows.get(row.index);
							const totalCols = row.getVisibleCells().length;
							const isDeleted = pending.isRowDeleted(row.index);
							return (
								<>
									<TableRow key={row.id}>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												className={`border-r last:border-r-0 truncate overflow-hidden cursor-default ${
													isDeleted && cell.column.id !== "_select"
														? "opacity-40 line-through"
														: ""
												}`}
												style={{ width: cell.column.getSize() }}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
									{subs && subs.length > 0 && (
										<tr key={`${row.id}-sub`}>
											<td
												colSpan={totalCols}
												className="p-0 bg-muted/20 border-b"
											>
												<div
													className="sticky left-0 p-4 overflow-hidden"
													style={{
														width: scrollRef.current?.clientWidth ?? "100%",
													}}
												>
													<div className="space-y-6">
														{subs.map((sub) => (
															<RelationSubTable
																key={`${sub.schema}.${sub.table}.${sub.column}`}
																schema={sub.schema}
																table={sub.table}
																filterColumn={sub.column}
																filterValue={sub.value}
																onNavigate={onNavigate}
															/>
														))}
													</div>
												</div>
											</td>
										</tr>
									)}
								</>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{/* Pending changes */}
			<PendingChangesBar
				edits={pending.edits}
				inserts={pending.inserts}
				deletes={pending.deletes}
				saving={saving}
				onSave={handleSave}
				onDiscard={pending.discard}
			/>

			{/* Pagination */}
			<div className="flex items-center justify-between px-4 h-12 border-t bg-muted/30 shrink-0">
				<span className="text-xs text-muted-foreground">
					Page {data.page} of {data.totalPages}
				</span>
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon-xs"
						disabled={page <= 1}
						onClick={() => setPage((p) => p - 1)}
					>
						<ChevronLeft className="size-3" />
					</Button>
					<Button
						variant="outline"
						size="icon-xs"
						disabled={page >= data.totalPages}
						onClick={() => setPage((p) => p + 1)}
					>
						<ChevronRight className="size-3" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function CellValue({
	value,
	column,
	isFKOpen,
	onNavigateFK,
}: {
	value: unknown;
	column: ColumnInfo;
	isFKOpen?: boolean;
	onNavigateFK?: (value: string) => void;
}) {
	if (value === null) {
		return (
			<span className="text-muted-foreground/50 italic text-xs">NULL</span>
		);
	}

	if (typeof value === "boolean") {
		return <div className="text-xs">{String(value).toUpperCase()}</div>;
	}

	if (typeof value === "object") {
		const str = JSON.stringify(value);
		return (
			<span className="font-mono text-xs truncate block" title={str}>
				{str.length > 60 ? `${str.slice(0, 60)}...` : str}
			</span>
		);
	}

	const str = String(value);

	if (column.foreign_key && onNavigateFK) {
		return (
			<Button
				variant={isFKOpen ? "default" : "secondary"}
				size="xs"
				className="hover:bg-primary hover:text-primary-foreground"
				onClick={() => onNavigateFK(str)}
				title={`${column.foreign_key.schema}.${column.foreign_key.table}`}
			>
				{str}
			</Button>
		);
	}

	if (column.type === "bytea") {
		const byteLen =
			typeof value === "string" ? Math.floor((str.length - 2) / 2) : 0;
		return (
			<span className="text-xs text-muted-foreground italic">
				&lt;binary {byteLen} bytes&gt;
			</span>
		);
	}

	if (column.type === "uuid") {
		return (
			<span className="font-mono text-xs truncate block" title={str}>
				{str.slice(0, 8)}...
			</span>
		);
	}

	if (column.type.includes("timestamp") || column.type === "date") {
		try {
			const d = new Date(str);
			if (Number.isNaN(d.getTime())) throw new Error();
			const y = d.getFullYear();
			const mo = String(d.getMonth() + 1).padStart(2, "0");
			const da = String(d.getDate()).padStart(2, "0");
			const h = String(d.getHours()).padStart(2, "0");
			const mi = String(d.getMinutes()).padStart(2, "0");
			const s = String(d.getSeconds()).padStart(2, "0");
			const ms = String(d.getMilliseconds());
			const formatted =
				column.type === "date"
					? `${y}-${mo}-${da}`
					: `${y}-${mo}-${da} ${h}:${mi}:${s}.${ms}`;
			return (
				<span className="text-xs" title={str}>
					{formatted}
				</span>
			);
		} catch {
			return <span className="text-xs">{str}</span>;
		}
	}

	if (
		column.type.includes("int") ||
		column.type === "numeric" ||
		column.type === "real" ||
		column.type === "double precision"
	) {
		return (
			<span className="text-xs font-mono tabular-nums text-right block">
				{str}
			</span>
		);
	}

	return (
		<span
			className="text-xs truncate block"
			title={str.length > 60 ? str : undefined}
		>
			{str.length > 100 ? `${str.slice(0, 100)}...` : str}
		</span>
	);
}
