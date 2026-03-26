import type { Tab } from "@client/hooks/use-tabs";
import { cn } from "@client/lib/utils";
import { Table2, Terminal, X } from "lucide-react";
import { Button } from "../ui/button";

interface TabBarProps {
	tabs: Tab[];
	activeTabId: string | null;
	onSelectTab: (id: string) => void;
	onCloseTab: (id: string) => void;
}

export function TabBar({
	tabs,
	activeTabId,
	onSelectTab,
	onCloseTab,
}: TabBarProps) {
	if (tabs.length === 0) return null;

	return (
		<div className="flex items-center gap-1 overflow-x-auto">
			{tabs.map((tab) => (
				<Button
					key={tab.id}
					type="button"
					variant={tab.id === activeTabId ? "secondary" : "ghost"}
					onClick={() => onSelectTab(tab.id)}
					size="xs"
				>
					{tab.type === "sql" ? (
						<Terminal className="size-3 shrink-0" />
					) : (
						<Table2 className="size-3 shrink-0" />
					)}
					<span>{tab.label}</span>
					<Button
						size="xs"
						type="button"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							onCloseTab(tab.id);
						}}
					>
						<X className="size-3" />
					</Button>
				</Button>
			))}
		</div>
	);
}
