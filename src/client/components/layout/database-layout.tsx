import { DataTableView } from "@client/components/data-table/data-table-view";
import { SchemaSidebar } from "@client/components/sidebar/schema-sidebar";
import { TabBar } from "@client/components/tabs/tab-bar";
import { Separator } from "@client/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@client/components/ui/sidebar";
import { useDatabase } from "@client/hooks/use-database";
import { useSettings } from "@client/hooks/use-settings";
import { useTabs } from "@client/hooks/use-tabs";
import { useTheme } from "@client/hooks/use-theme";
import { api } from "@client/lib/api";
import { lazy, Suspense } from "react";
import { Database, Loader2 } from "lucide-react";

const SqlEditor = lazy(() =>
	import("@client/components/sql-editor/sql-editor").then((m) => ({
		default: m.SqlEditor,
	})),
);

interface DatabaseLayoutProps {
	onDisconnected: () => void;
}

export function DatabaseLayout({ onDisconnected }: DatabaseLayoutProps) {
	const { schemas, loading, refresh } = useDatabase();
	const { settings, updateSettings } = useSettings();
	const { theme, setTheme } = useTheme();
	const {
		tabs,
		activeTab,
		activeTabId,
		setActiveTabId,
		openTable,
		openSqlEditor,
		closeTab,
	} = useTabs();

	async function handleDisconnect() {
		await api.connection.disconnect();
		onDisconnected();
	}

	return (
		<SidebarProvider>
			<SchemaSidebar
				schemas={schemas}
				loading={loading}
				showEnums={settings.showEnums}
				theme={theme}
				onSelectTable={openTable}
				onOpenSql={openSqlEditor}
				onRefresh={refresh}
				onDisconnect={handleDisconnect}
				onToggleShowEnums={(show) => updateSettings({ showEnums: show })}
				onSetTheme={setTheme}
			/>
			<SidebarInset className="min-w-0 overflow-hidden">
				<header className="h-12 flex shrink-0 items-center gap-2 border-b bg-muted/30 px-2">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-1 h-4" />
					<TabBar
						tabs={tabs}
						activeTabId={activeTabId}
						onSelectTab={setActiveTabId}
						onCloseTab={closeTab}
					/>
				</header>
				<div className="flex-1 min-h-0">
					{activeTab ? (
						activeTab.type === "table" ? (
							<DataTableView
								key={activeTab.id}
								schema={activeTab.schema!}
								table={activeTab.table!}
								onNavigate={openTable}
							/>
						) : (
							<Suspense
								fallback={
									<div className="flex items-center justify-center h-full">
										<Loader2 className="size-5 animate-spin text-muted-foreground" />
									</div>
								}
							>
								<SqlEditor key={activeTab.id} />
							</Suspense>
						)
					) : (
						<EmptyState />
					)}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center gap-3">
			<Database className="size-10 text-muted-foreground/40" />
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					No table selected
				</p>
				<p className="text-xs text-muted-foreground/70 mt-1">
					Click a table in the sidebar to browse its data
				</p>
			</div>
		</div>
	);
}
