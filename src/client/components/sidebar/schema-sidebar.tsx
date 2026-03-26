import { Button } from "@client/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@client/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@client/components/ui/select";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@client/components/ui/sidebar";
import { Switch } from "@client/components/ui/switch";
import type { SchemaTree } from "@client/hooks/use-database";
import {
	Database,
	Eye,
	List,
	LogOut,
	Monitor,
	Moon,
	MoreHorizontal,
	RefreshCw,
	Settings,
	Sun,
	Table2,
	Terminal,
} from "lucide-react";
import { useState } from "react";

interface SchemaSidebarProps {
	schemas: SchemaTree[];
	loading: boolean;
	showEnums: boolean;
	theme: "light" | "dark" | "system";
	onSelectTable: (schema: string, table: string) => void;
	onOpenSql: () => void;
	onRefresh: () => void;
	onDisconnect: () => void;
	onToggleShowEnums: (show: boolean) => void;
	onSetTheme: (theme: "light" | "dark" | "system") => void;
}

export function SchemaSidebar({
	schemas,
	loading,
	showEnums,
	theme,
	onSelectTable,
	onOpenSql,
	onRefresh,
	onDisconnect,
	onToggleShowEnums,
	onSetTheme,
}: SchemaSidebarProps) {
	const [filter, setFilter] = useState("");
	const [selectedSchema, setSelectedSchema] = useState(
		() =>
			schemas.find((s) => s.name === "public")?.name ?? schemas[0]?.name ?? "",
	);

	// Update selected schema when schemas load
	if (schemas.length > 0 && !schemas.find((s) => s.name === selectedSchema)) {
		setSelectedSchema(
			schemas.find((s) => s.name === "public")?.name ?? schemas[0].name,
		);
	}

	const activeSchema = schemas.find((s) => s.name === selectedSchema);

	const filteredTables = activeSchema
		? filter
			? activeSchema.tables.filter((t) =>
					t.name.toLowerCase().includes(filter.toLowerCase()),
				)
			: activeSchema.tables
		: [];

	const filteredEnums = activeSchema
		? filter
			? activeSchema.enums.filter((e) =>
					e.name.toLowerCase().includes(filter.toLowerCase()),
				)
			: activeSchema.enums
		: [];

	return (
		<Sidebar>
			<SidebarHeader className="gap-2">
				<div className="flex items-center justify-between h-10">
					<div className="flex items-center gap-2">
						<Database className="size-4 text-muted-foreground" />
						<span
							className="text-sm font-bold text-muted-foreground"
							style={{ fontFamily: "'Pixelify Sans', sans-serif" }}
						>
							pglens
						</span>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start gap-2"
					onClick={onOpenSql}
				>
					<Terminal className="size-3.5" />
					SQL Editor
				</Button>
				<Select value={selectedSchema} onValueChange={setSelectedSchema}>
					<SelectTrigger size="sm" className="w-full">
						<SelectValue placeholder="Schema" />
					</SelectTrigger>
					<SelectContent>
						{schemas.map((s) => (
							<SelectItem key={s.name} value={s.name}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-1">
					<SidebarInput
						className="h-8 flex-1"
						placeholder="Filter tables..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={onRefresh}
						title="Refresh schema"
					>
						<RefreshCw className="size-3.5" />
					</Button>
				</div>
			</SidebarHeader>

			<SidebarContent>
				{loading ? (
					<div className="px-3 py-8 text-center text-xs text-muted-foreground">
						Loading schemas...
					</div>
				) : filteredTables.length === 0 && filteredEnums.length === 0 ? (
					<div className="px-3 py-8 text-center text-xs text-muted-foreground">
						{filter ? "No tables match filter" : "No tables found"}
					</div>
				) : (
					<SidebarGroup className="py-0">
						<SidebarGroupLabel className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
							Tables
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{filteredTables.map((table) => (
									<SidebarMenuItem key={table.name}>
										<SidebarMenuButton
											onClick={() => onSelectTable(selectedSchema, table.name)}
											tooltip={`${table.column_count} columns, ${table.row_count.toLocaleString()} rows`}
										>
											{table.type === "view" ? (
												<Eye className="text-blue-500" />
											) : (
												<Table2 />
											)}
											<span className="truncate overflow-hidden pr-5">
												{table.name}
											</span>
										</SidebarMenuButton>
										<SidebarMenuBadge>
											{table.row_count < 0
												? 0
												: table.row_count.toLocaleString()}
										</SidebarMenuBadge>
									</SidebarMenuItem>
								))}
								{showEnums && filteredEnums.length > 0 && (
									<>
										<SidebarMenuItem>
											<div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
												Enums
											</div>
										</SidebarMenuItem>
										{filteredEnums.map((e) => (
											<SidebarMenuItem key={e.name}>
												<SidebarMenuButton tooltip={e.values.join(", ")}>
													<List className="text-purple-500" />
													<span className="truncate overflow-hidden pr-5">
														{e.name}
													</span>
												</SidebarMenuButton>
												<SidebarMenuBadge>{e.values.length}</SidebarMenuBadge>
											</SidebarMenuItem>
										))}
									</>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			<SidebarFooter className="border-t">
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<Settings />
									<span>Settings</span>
									<MoreHorizontal className="ml-auto" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" align="start" className="w-56">
								<DropdownMenuLabel>Options</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={(e) => e.preventDefault()}
									className="flex items-center justify-between"
								>
									<span>Show enums</span>
									<Switch
										checked={showEnums}
										onCheckedChange={onToggleShowEnums}
									/>
								</DropdownMenuItem>

								<DropdownMenuSeparator />
								<DropdownMenuLabel>Theme</DropdownMenuLabel>
								<DropdownMenuGroup>
									<DropdownMenuItem onClick={() => onSetTheme("light")}>
										<Sun />
										<span>Light</span>
										{theme === "light" && (
											<span className="ml-auto text-xs text-muted-foreground">
												Active
											</span>
										)}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onSetTheme("dark")}>
										<Moon />
										<span>Dark</span>
										{theme === "dark" && (
											<span className="ml-auto text-xs text-muted-foreground">
												Active
											</span>
										)}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onSetTheme("system")}>
										<Monitor />
										<span>System</span>
										{theme === "system" && (
											<span className="ml-auto text-xs text-muted-foreground">
												Active
											</span>
										)}
									</DropdownMenuItem>
								</DropdownMenuGroup>

								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={onDisconnect}
									className="text-destructive focus:text-destructive"
								>
									<LogOut />
									<span>Disconnect</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
