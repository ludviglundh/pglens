import { useCallback, useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import { Separator } from "@client/components/ui/separator";
import { api, type QueryResult } from "@client/lib/api";
import {
	AlertTriangle,
	Download,
	Loader2,
	Play,
} from "lucide-react";

const DESTRUCTIVE_PATTERNS = [
	/^\s*DROP\s/i,
	/^\s*TRUNCATE\s/i,
	/^\s*DELETE\s+FROM\s+\S+\s*$/i, // DELETE without WHERE
	/^\s*ALTER\s+TABLE\s+\S+\s+DROP\s/i,
];

function isDestructive(query: string): string | null {
	const trimmed = query.trim();
	if (DESTRUCTIVE_PATTERNS[0].test(trimmed)) return "This will DROP an object. Are you sure?";
	if (DESTRUCTIVE_PATTERNS[1].test(trimmed)) return "This will TRUNCATE all rows. Are you sure?";
	if (DESTRUCTIVE_PATTERNS[2].test(trimmed)) return "This DELETE has no WHERE clause and will affect all rows. Are you sure?";
	if (DESTRUCTIVE_PATTERNS[3].test(trimmed)) return "This will DROP a column. Are you sure?";
	return null;
}

export function SqlEditor() {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [warning, setWarning] = useState<string | null>(null);
	const [pendingQuery, setPendingQuery] = useState<string | null>(null);
	const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

	const executeQuery = useCallback(async (queryText: string) => {
		const trimmed = queryText.trim();
		if (!trimmed) return;

		// Check for destructive patterns
		const destructiveWarning = isDestructive(trimmed);
		if (destructiveWarning && !pendingQuery) {
			setWarning(destructiveWarning);
			setPendingQuery(trimmed);
			return;
		}

		setWarning(null);
		setPendingQuery(null);
		setLoading(true);
		setError(null);

		try {
			const res = await api.data.query(trimmed);
			setResult(res);
		} catch (err) {
			setError((err as Error).message);
			setResult(null);
		} finally {
			setLoading(false);
		}
	}, [pendingQuery]);

	const runFromEditor = useCallback(() => {
		if (!viewRef.current) return;
		const state = viewRef.current.state;
		// Run selection if any, otherwise full content
		const selection = state.sliceDoc(
			state.selection.main.from,
			state.selection.main.to,
		);
		const queryText = selection || state.doc.toString();
		executeQuery(queryText);
	}, [executeQuery]);

	useEffect(() => {
		if (!editorRef.current) return;

		const state = EditorState.create({
			doc: "",
			extensions: [
				basicSetup,
				sql({ dialect: PostgreSQL }),
				oneDark,
				cmPlaceholder("Write your SQL query here... (Ctrl+Enter to run)"),
				keymap.of([
					{
						key: "Ctrl-Enter",
						mac: "Cmd-Enter",
						run: () => {
							runFromEditor();
							return true;
						},
					},
				]),
				EditorView.theme({
					"&": { height: "100%", fontSize: "13px" },
					".cm-scroller": { overflow: "auto" },
					".cm-content": { minHeight: "100px" },
				}),
			],
		});

		const view = new EditorView({
			state,
			parent: editorRef.current,
		});

		viewRef.current = view;

		return () => view.destroy();
	}, [runFromEditor]);

	function exportResults() {
		if (!result || !result.rows.length) return;

		let content: string;
		let mimeType: string;
		let filename: string;

		if (exportFormat === "json") {
			content = JSON.stringify(result.rows, null, 2);
			mimeType = "application/json";
			filename = "query-results.json";
		} else {
			const cols = Object.keys(result.rows[0]);
			const lines = [cols.join(",")];
			for (const row of result.rows) {
				lines.push(
					cols
						.map((col) => {
							const val = row[col];
							if (val === null) return "";
							const str = typeof val === "object" ? JSON.stringify(val) : String(val);
							return str.includes(",") || str.includes('"') || str.includes("\n")
								? `"${str.replace(/"/g, '""')}"`
								: str;
						})
						.join(","),
				);
			}
			content = lines.join("\n");
			mimeType = "text/csv";
			filename = "query-results.csv";
		}

		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	const resultColumns = result?.rows.length
		? Object.keys(result.rows[0])
		: [];

	return (
		<div className="flex flex-col h-full">
			{/* Editor */}
			<div className="h-[200px] shrink-0 border-b">
				<div ref={editorRef} className="h-full" />
			</div>

			{/* Toolbar */}
			<div className="flex items-center gap-2 px-3 h-10 border-b shrink-0 bg-muted/30">
				<Button size="sm" onClick={runFromEditor} disabled={loading} className="gap-1">
					{loading ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<Play className="size-3" />
					)}
					Run
				</Button>
				<span className="text-xs text-muted-foreground">Ctrl+Enter</span>

				{result && result.rows.length > 0 && (
					<>
						<Separator orientation="vertical" className="h-5" />
						<span className="text-xs text-muted-foreground">
							{result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
						</span>
						<Separator orientation="vertical" className="h-5" />
						<Select
							value={exportFormat}
							onValueChange={(v) => setExportFormat(v as "csv" | "json")}
						>
							<SelectTrigger className="h-7 w-[80px] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="csv">CSV</SelectItem>
								<SelectItem value="json">JSON</SelectItem>
							</SelectContent>
						</Select>
						<Button variant="outline" size="sm" onClick={exportResults} className="gap-1">
							<Download className="size-3" />
							Export
						</Button>
					</>
				)}
			</div>

			{/* Warning */}
			{warning && (
				<div className="flex items-center gap-2 px-4 py-2 border-b bg-destructive/10 text-destructive shrink-0">
					<AlertTriangle className="size-4 shrink-0" />
					<span className="text-sm flex-1">{warning}</span>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => pendingQuery && executeQuery(pendingQuery)}
					>
						Execute anyway
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setWarning(null);
							setPendingQuery(null);
						}}
					>
						Cancel
					</Button>
				</div>
			)}

			{/* Results */}
			<div className="flex-1 min-h-0 overflow-auto">
				{error ? (
					<div className="p-4 text-sm text-destructive">{error}</div>
				) : result ? (
					result.rows.length === 0 ? (
						<div className="p-4 text-sm text-muted-foreground">
							Query executed successfully. No rows returned.
						</div>
					) : (
						<Table>
							<TableHeader className="sticky top-0 bg-background z-10">
								<TableRow>
									{resultColumns.map((col) => (
										<TableHead key={col} className="text-xs">
											{col}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.rows.map((row, i) => (
									<TableRow key={i}>
										{resultColumns.map((col) => {
											const val = row[col];
											return (
												<TableCell key={col} className="text-xs font-mono max-w-[300px] truncate">
													{val === null ? (
														<span className="text-muted-foreground/50 italic">NULL</span>
													) : typeof val === "object" ? (
														JSON.stringify(val)
													) : (
														String(val)
													)}
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>
					)
				) : (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						Run a query to see results
					</div>
				)}
			</div>
		</div>
	);
}
