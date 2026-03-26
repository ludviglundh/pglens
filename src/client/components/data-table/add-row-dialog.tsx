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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@client/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import { Textarea } from "@client/components/ui/textarea";
import type { ColumnInfo } from "@client/lib/api";
import { api } from "@client/lib/api";
import { AlertCircle, Calendar as CalendarIcon, Loader2, Plus } from "lucide-react";
import { TimestampEditor } from "./timestamp-editor";

interface AddRowDialogProps {
	columns: ColumnInfo[];
	schema: string;
	table: string;
	enumValues: Record<string, string[]>;
	onSuccess: () => void;
}

interface ParsedError {
	column: string | null;
	message: string;
}

function parsePostgresError(
	error: string,
	columns: ColumnInfo[],
	submittedData: Record<string, unknown>,
): ParsedError {
	const nullMatch = error.match(/null value in column "([^"]+)".*not-null/i);
	if (nullMatch) return { column: nullMatch[1], message: "This field is required" };

	const uniqueMatch = error.match(/Key \(([^)]+)\)=\(([^)]*)\) already exists/i);
	if (uniqueMatch) return { column: uniqueMatch[1], message: `Value "${uniqueMatch[2]}" already exists` };

	const fkMatch = error.match(/Key \(([^)]+)\)=\(([^)]*)\) is not present/i);
	if (fkMatch) return { column: fkMatch[1], message: `Referenced value "${fkMatch[2]}" does not exist` };

	// "invalid input syntax for type integer: "abc""
	// Try to find which submitted column matches that type
	const syntaxMatch = error.match(/invalid input syntax for type (\w+): "([^"]*)"/i);
	if (syntaxMatch) {
		const errType = syntaxMatch[1].toLowerCase();
		const errValue = syntaxMatch[2];
		const msg = `Invalid ${syntaxMatch[1]} value: "${errValue}"`;
		// Find column with matching type and matching submitted value
		const matchedCol = columns.find((col) => {
			const ct = col.type.toLowerCase();
			const val = String(submittedData[col.name] ?? "");
			return ct.includes(errType) && val === errValue;
		});
		if (matchedCol) return { column: matchedCol.name, message: msg };
		// Fallback: find any column with that type that was submitted
		const typeCol = columns.find((col) =>
			col.type.toLowerCase().includes(errType) && col.name in submittedData,
		);
		if (typeCol) return { column: typeCol.name, message: msg };
		return { column: null, message: msg };
	}

	// "value too long for type character varying(50)"
	const lengthMatch = error.match(/value too long for type (.+)/i);
	if (lengthMatch) {
		const errType = lengthMatch[1].toLowerCase();
		const msg = `Value too long for ${lengthMatch[1]}`;
		// Find the column with the longest submitted value of that type
		const matchedCol = columns
			.filter((col) => col.type.toLowerCase().includes("char") && col.name in submittedData)
			.sort((a, b) => String(submittedData[b.name] ?? "").length - String(submittedData[a.name] ?? "").length)[0];
		if (matchedCol) return { column: matchedCol.name, message: msg };
		return { column: null, message: msg };
	}

	const checkMatch = error.match(/violates check constraint "([^"]+)"/i);
	if (checkMatch) return { column: null, message: `Check constraint "${checkMatch[1]}" violated` };

	const colMatch = error.match(/column "([^"]+)"/i);
	if (colMatch) return { column: colMatch[1], message: error };

	return { column: null, message: error };
}

function getFieldType(
	col: ColumnInfo,
	enumValues: Record<string, string[]>,
): "boolean" | "enum" | "number" | "textarea" | "timestamp" | "text" {
	const t = col.type.toLowerCase();
	if (t === "boolean") return "boolean";
	if (t.includes("timestamp") || t === "date") return "timestamp";
	if (Object.keys(enumValues).some((name) => t === name || t.endsWith(`.${name}`)))
		return "enum";
	if (t.startsWith("user-defined")) return "enum";
	if (t === "text" || t === "jsonb" || t === "json") return "textarea";
	if (t.includes("int") || t === "numeric" || t === "real" || t === "double precision" || t === "bigint" || t === "smallint")
		return "number";
	return "text";
}

function getEnumVals(col: ColumnInfo, enumValues: Record<string, string[]>): string[] {
	const t = col.type.toLowerCase();
	if (enumValues[t]) return enumValues[t];
	for (const [name, values] of Object.entries(enumValues)) {
		if (t === name || t.endsWith(`.${name}`)) return values;
	}
	return [];
}

export function AddRowDialog({
	columns,
	schema,
	table,
	enumValues,
	onSuccess,
}: AddRowDialogProps) {
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [tsPopover, setTsPopover] = useState<string | null>(null);

	function handleOpen(isOpen: boolean) {
		setOpen(isOpen);
		if (isOpen) {
			setValues({});
			setError(null);
			setFieldErrors({});
		}
	}

	function setValue(colName: string, val: string) {
		setValues((prev) => ({ ...prev, [colName]: val }));
		if (fieldErrors[colName]) {
			setFieldErrors((prev) => {
				const next = { ...prev };
				delete next[colName];
				return next;
			});
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setFieldErrors({});

		// Client-side validation: check required fields
		const errors: Record<string, string> = {};
		const data: Record<string, unknown> = {};
		for (const col of columns) {
			const val = values[col.name];
			if (val === undefined || val === "") {
				if (col.default_value || col.nullable) continue;
				// Required field with no value
				errors[col.name] = "This field is required";
				continue;
			}
			data[col.name] = val;
		}

		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			return;
		}

		setSubmitting(true);
		try {
			await api.data.update(schema, table, [{ type: "insert", data }]);
			onSuccess();
			setOpen(false);
		} catch (err) {
			const raw = (err as Error).message;
			const parsed = parsePostgresError(raw, columns, data);

			if (parsed.column) {
				setFieldErrors((prev) => ({ ...prev, [parsed.column!]: parsed.message }));
			} else {
				setError(parsed.message);
			}
		} finally {
			setSubmitting(false);
		}
	}

	function renderField(col: ColumnInfo) {
		const fieldType = getFieldType(col, enumValues);
		const fieldError = fieldErrors[col.name];
		const errorClass = fieldError ? "border-destructive focus-visible:ring-destructive/50" : "";
		const val = values[col.name] ?? "";

		switch (fieldType) {
			case "boolean":
				return (
					<Select value={val || undefined} onValueChange={(v) => setValue(col.name, v)}>
						<SelectTrigger className={`h-8 text-xs ${errorClass}`} aria-invalid={!!fieldError}>
							<SelectValue placeholder={col.nullable ? "NULL" : "Select..."} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="true">TRUE</SelectItem>
							<SelectItem value="false">FALSE</SelectItem>
						</SelectContent>
					</Select>
				);

			case "enum": {
				const enumVals = getEnumVals(col, enumValues);
				return (
					<Select value={val || undefined} onValueChange={(v) => setValue(col.name, v)}>
						<SelectTrigger className={`h-8 text-xs ${errorClass}`} aria-invalid={!!fieldError}>
							<SelectValue placeholder={col.nullable ? "NULL" : "Select..."} />
						</SelectTrigger>
						<SelectContent>
							{enumVals.map((v) => (
								<SelectItem key={v} value={v}>{v}</SelectItem>
							))}
						</SelectContent>
					</Select>
				);
			}

			case "timestamp":
				return (
					<Popover open={tsPopover === col.name} onOpenChange={(o) => setTsPopover(o ? col.name : null)}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								className={`h-8 w-full justify-start text-xs font-mono ${!val ? "text-muted-foreground" : ""} ${errorClass}`}
								aria-invalid={!!fieldError}
							>
								<CalendarIcon className="size-3 mr-2" />
								{val || (col.nullable ? "NULL" : "Pick date...")}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<TimestampEditor
								value={val || new Date().toISOString()}
								onChange={(v) => setValue(col.name, v)}
								onSetNull={() => {
									setValue(col.name, "");
									setTsPopover(null);
								}}
							/>
							<div className="flex items-center justify-end gap-1.5 p-2 border-t">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setTsPopover(null)}
								>
									Done
								</Button>
							</div>
						</PopoverContent>
					</Popover>
				);

			case "textarea":
				return (
					<Textarea
						placeholder={col.default_value ?? (col.nullable ? "NULL" : "")}
						value={val}
						onChange={(e) => setValue(col.name, e.target.value)}
						className={`text-xs font-mono min-h-[60px] ${errorClass}`}
						aria-invalid={!!fieldError}
					/>
				);

			case "number":
				return (
					<Input
						type="number"
						placeholder={col.default_value ?? (col.nullable ? "NULL" : "")}
						value={val}
						onChange={(e) => setValue(col.name, e.target.value)}
						className={`h-8 text-xs font-mono ${errorClass}`}
						aria-invalid={!!fieldError}
					/>
				);

			default:
				return (
					<Input
						placeholder={col.default_value ?? (col.nullable ? "NULL" : "")}
						value={val}
						onChange={(e) => setValue(col.name, e.target.value)}
						className={`h-8 text-xs font-mono ${errorClass}`}
						aria-invalid={!!fieldError}
					/>
				);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-1">
					<Plus className="size-3" />
					Add row
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg flex flex-col max-h-[80vh] overflow-hidden">
				<DialogHeader>
					<DialogTitle>Add row</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={handleSubmit}
					className="flex flex-col min-h-0 flex-1 overflow-hidden"
				>
					<div className="flex-1 overflow-y-auto pr-2">
						<div className="space-y-3 py-2">
							{columns.map((col) => {
								const fieldError = fieldErrors[col.name];
								return (
									<div key={col.name} className="space-y-1">
										<Label className="text-xs">
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
										{renderField(col)}
										{fieldError && (
											<p className="text-[11px] text-destructive flex items-center gap-1">
												<AlertCircle className="size-3 shrink-0" />
												{fieldError}
											</p>
										)}
									</div>
								);
							})}
						</div>
					</div>

					{error && (
						<div className="flex items-center gap-2 px-1 py-2 text-sm text-destructive border-t mt-2 pt-2">
							<AlertCircle className="size-4 shrink-0" />
							<span className="text-xs">{error}</span>
						</div>
					)}

					<DialogFooter className="mt-4 shrink-0 border-t pt-4">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Loader2 className="size-3 animate-spin" />}
							Add row
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
