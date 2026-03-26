import { useCallback, useEffect, useRef } from "react";
import {
	useQueryState,
	parseAsString,
	parseAsArrayOf,
} from "nuqs";

export interface Tab {
	id: string;
	type: "table" | "sql";
	schema?: string;
	table?: string;
	label: string;
}

function tabIdToTab(id: string): Tab {
	if (id === "sql") {
		return { id: "sql", type: "sql", label: "SQL" };
	}
	const [schema, table] = id.split(".");
	return {
		id,
		type: "table",
		schema,
		table,
		label: schema === "public" ? table : id,
	};
}

export function useTabs() {
	const [openTabIds, setOpenTabIds] = useQueryState(
		"tabs",
		parseAsArrayOf(parseAsString, ",").withDefault([]),
	);
	const [activeTabId, setActiveTabId] = useQueryState(
		"tab",
		parseAsString.withDefault(""),
	);

	const tabs = openTabIds.map(tabIdToTab);
	const activeTab =
		activeTabId ? (tabs.find((t) => t.id === activeTabId) ?? null) : null;

	const openTable = useCallback(
		(schema: string, table: string) => {
			const id = `${schema}.${table}`;
			setOpenTabIds((prev) => {
				if (prev.includes(id)) return prev;
				return [...prev, id];
			});
			setActiveTabId(id);
		},
		[setOpenTabIds, setActiveTabId],
	);

	const openSqlEditor = useCallback(() => {
		setOpenTabIds((prev) => {
			if (prev.includes("sql")) return prev;
			return [...prev, "sql"];
		});
		setActiveTabId("sql");
	}, [setOpenTabIds, setActiveTabId]);

	const closeTab = useCallback(
		(id: string) => {
			setOpenTabIds((prev) => {
				const next = prev.filter((t) => t !== id);
				if (activeTabId === id) {
					const idx = prev.indexOf(id);
					const newActive = next[Math.min(idx, next.length - 1)];
					setActiveTabId(newActive ?? null);
				}
				return next;
			});
		},
		[activeTabId, setOpenTabIds, setActiveTabId],
	);

	return {
		tabs,
		activeTab,
		activeTabId,
		setActiveTabId,
		openTable,
		openSqlEditor,
		closeTab,
	};
}
