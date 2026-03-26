import { useState, useCallback } from "react";

export interface CellEdit {
	rowIndex: number;
	column: string;
	oldValue: unknown;
	newValue: unknown;
}

export interface PendingInsert {
	data: Record<string, unknown>;
}

export interface PendingDelete {
	rowIndex: number;
	pkValues: Record<string, unknown>;
}

export function usePendingChanges() {
	const [edits, setEdits] = useState<CellEdit[]>([]);
	const [inserts, setInserts] = useState<PendingInsert[]>([]);
	const [deletes, setDeletes] = useState<PendingDelete[]>([]);

	const hasChanges = edits.length > 0 || inserts.length > 0 || deletes.length > 0;
	const changeCount = edits.length + inserts.length + deletes.length;

	const addEdit = useCallback((edit: CellEdit) => {
		setEdits((prev) => {
			// If editing same cell, update the existing edit
			const existing = prev.findIndex(
				(e) => e.rowIndex === edit.rowIndex && e.column === edit.column,
			);
			if (existing >= 0) {
				const updated = [...prev];
				// If new value equals original, remove the edit
				if (edit.newValue === prev[existing].oldValue) {
					return updated.filter((_, i) => i !== existing);
				}
				updated[existing] = { ...prev[existing], newValue: edit.newValue };
				return updated;
			}
			// Don't add if value hasn't changed
			if (edit.oldValue === edit.newValue) return prev;
			return [...prev, edit];
		});
	}, []);

	const addInsert = useCallback((data: Record<string, unknown>) => {
		setInserts((prev) => [...prev, { data }]);
	}, []);

	const addDelete = useCallback((rowIndex: number, pkValues: Record<string, unknown>) => {
		setDeletes((prev) => {
			// Toggle — if already marked for delete, remove it
			const existing = prev.findIndex((d) => d.rowIndex === rowIndex);
			if (existing >= 0) return prev.filter((_, i) => i !== existing);
			return [...prev, { rowIndex, pkValues }];
		});
	}, []);

	const isRowDeleted = useCallback(
		(rowIndex: number) => deletes.some((d) => d.rowIndex === rowIndex),
		[deletes],
	);

	const getCellEdit = useCallback(
		(rowIndex: number, column: string) =>
			edits.find((e) => e.rowIndex === rowIndex && e.column === column),
		[edits],
	);

	const discard = useCallback(() => {
		setEdits([]);
		setInserts([]);
		setDeletes([]);
	}, []);

	// Build changes array for the server API
	function buildChanges(
		rows: Record<string, unknown>[],
		pkColumns: string[],
	) {
		const changes: Array<{
			type: "update" | "insert" | "delete";
			data?: Record<string, unknown>;
			where?: Record<string, unknown>;
		}> = [];

		// Group edits by row
		const editsByRow = new Map<number, CellEdit[]>();
		for (const edit of edits) {
			const existing = editsByRow.get(edit.rowIndex) ?? [];
			existing.push(edit);
			editsByRow.set(edit.rowIndex, existing);
		}

		for (const [rowIndex, rowEdits] of editsByRow) {
			const row = rows[rowIndex];
			if (!row) continue;
			const where: Record<string, unknown> = {};
			for (const pk of pkColumns) where[pk] = row[pk];
			const data: Record<string, unknown> = {};
			for (const edit of rowEdits) data[edit.column] = edit.newValue;
			changes.push({ type: "update", data, where });
		}

		for (const ins of inserts) {
			changes.push({ type: "insert", data: ins.data });
		}

		for (const del of deletes) {
			changes.push({ type: "delete", where: del.pkValues });
		}

		return changes;
	}

	return {
		edits,
		inserts,
		deletes,
		hasChanges,
		changeCount,
		addEdit,
		addInsert,
		addDelete,
		isRowDeleted,
		getCellEdit,
		discard,
		buildChanges,
	};
}
