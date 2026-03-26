import { Button } from "@client/components/ui/button";
import { Input } from "@client/components/ui/input";
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
import { useEffect, useRef, useState } from "react";
import { TimestampEditor } from "./timestamp-editor";

interface CellEditorProps {
	column: ColumnInfo;
	value: unknown;
	enumOptions?: Record<string, string[]>;
	onSave: (newValue: unknown) => void;
	onCancel: () => void;
	children: React.ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function getEditorType(
	col: ColumnInfo,
	enumOptions?: Record<string, string[]>,
): "boolean" | "enum" | "text" | "number" | "textarea" | "timestamp" {
	const t = col.type.toLowerCase();
	if (t === "boolean") return "boolean";
	if (t.includes("timestamp") || t === "date") return "timestamp";
	// Check if column type matches a known enum
	if (
		enumOptions &&
		Object.keys(enumOptions).some(
			(name) => t === name || t.endsWith(`.${name}`),
		)
	)
		return "enum";
	if (t.startsWith("user-defined")) return "enum";
	if (t === "text" || t === "jsonb" || t === "json") return "textarea";
	if (
		t.includes("int") ||
		t === "numeric" ||
		t === "real" ||
		t === "double precision" ||
		t === "bigint" ||
		t === "smallint"
	)
		return "number";
	return "text";
}

function getEnumValues(
	col: ColumnInfo,
	enumOptions?: Record<string, string[]>,
): string[] {
	if (!enumOptions) return [];
	const t = col.type.toLowerCase();
	// Direct match
	if (enumOptions[t]) return enumOptions[t];
	// Match without schema prefix
	for (const [name, values] of Object.entries(enumOptions)) {
		if (t === name || t.endsWith(`.${name}`)) return values;
	}
	return [];
}

export function CellEditor({
	column,
	value,
	enumOptions,
	onSave,
	onCancel,
	children,
	open,
	onOpenChange,
}: CellEditorProps) {
	const [editValue, setEditValue] = useState<string>(
		value === null
			? ""
			: typeof value === "object"
				? JSON.stringify(value, null, 2)
				: String(value),
	);
	const [isNull, setIsNull] = useState(value === null);
	const editorType = getEditorType(column, enumOptions);
	const enumVals = getEnumValues(column, enumOptions);
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) {
			setEditValue(
				value === null
					? ""
					: typeof value === "object"
						? JSON.stringify(value, null, 2)
						: String(value),
			);
			setIsNull(value === null);
		}
	}, [open, value]);

	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	function handleSave() {
		if (isNull) {
			onSave(null);
		} else {
			onSave(editValue);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			onCancel();
		}
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			handleSave();
		}
		if (
			e.key === "Enter" &&
			editorType !== "textarea" &&
			editorType !== "timestamp" &&
			!e.metaKey &&
			!e.ctrlKey
		) {
			e.preventDefault();
			handleSave();
		}
	}

	if (editorType === "timestamp") {
		return (
			<Popover open={open} onOpenChange={onOpenChange}>
				<PopoverTrigger asChild>{children}</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start" side="bottom">
					<TimestampEditor
						value={editValue}
						onChange={setEditValue}
						onSetNull={() => {
							setIsNull(true);
							onSave(null);
						}}
					/>
					<div className="flex items-center justify-end gap-1.5 p-2 border-t">
						<Button variant="ghost" size="sm" onClick={onCancel}>
							Cancel
							<kbd className="ml-1 text-[10px] text-muted-foreground border px-1">
								Esc
							</kbd>
						</Button>
						<Button size="sm" onClick={handleSave}>
							Save
							<kbd className="ml-1 text-[10px] text-primary-foreground/70 border border-primary-foreground/20 px-1">
								⌘↵
							</kbd>
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className="p-3 space-y-3"
				align="start"
				side="bottom"
				onKeyDown={handleKeyDown}
			>
				{isNull ? (
					<div className="text-sm text-muted-foreground italic py-2">NULL</div>
				) : editorType === "boolean" ? (
					<Select
						value={editValue}
						onValueChange={(v) => {
							setEditValue(v);
						}}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="true">true</SelectItem>
							<SelectItem value="false">false</SelectItem>
						</SelectContent>
					</Select>
				) : editorType === "enum" ? (
					<Select
						value={editValue}
						onValueChange={(v) => {
							setEditValue(v);
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select value" />
						</SelectTrigger>
						<SelectContent>
							{enumVals.map((val) => (
								<SelectItem key={val} value={val}>
									{val}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : editorType === "textarea" ? (
					<Textarea
						ref={inputRef as React.Ref<HTMLTextAreaElement>}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						className="font-mono text-xs min-h-[100px]"
					/>
				) : (
					<Input
						ref={inputRef as React.Ref<HTMLInputElement>}
						type={editorType === "number" ? "number" : "text"}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						className="font-mono text-xs"
					/>
				)}

				{/* Actions */}
				<div className="flex items-center justify-between w-full">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							if (isNull) {
								setIsNull(false);
								setEditValue(
									value === null
										? ""
										: typeof value === "object"
											? JSON.stringify(value, null, 2)
											: String(value),
								);
							} else {
								setIsNull(true);
							}
						}}
					>
						{isNull ? "Unset NULL" : "Set NULL"}
					</Button>
					<div className="flex items-center gap-1.5">
						<Button variant="ghost" size="sm" onClick={onCancel}>
							Cancel
							<kbd className="ml-1 text-[10px] text-muted-foreground border px-1">
								Esc
							</kbd>
						</Button>
						<Button size="sm" onClick={handleSave}>
							Save
							<kbd className="ml-1 text-[10px] text-primary-foreground/70 border border-primary-foreground/20 px-1">
								⌘↵
							</kbd>
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
