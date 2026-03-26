import { Button } from "@client/components/ui/button";
import { Input } from "@client/components/ui/input";
import { Label } from "@client/components/ui/label";
import { Separator } from "@client/components/ui/separator";
import { Switch } from "@client/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@client/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface ConnectionFormProps {
	onConnect: (connectionString: string, name?: string) => void;
	isConnecting: boolean;
}

export function ConnectionForm({
	onConnect,
	isConnecting,
}: ConnectionFormProps) {
	const [mode, setMode] = useState<"string" | "fields">("string");
	const [connectionString, setConnectionString] = useState("");
	const [name, setName] = useState("");

	// Field mode state
	const [host, setHost] = useState("localhost");
	const [port, setPort] = useState("5432");
	const [database, setDatabase] = useState("");
	const [user, setUser] = useState("postgres");
	const [password, setPassword] = useState("");
	const [ssl, setSsl] = useState(false);
	const [showConnStr, setShowConnStr] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	function buildConnectionString() {
		const sslParam = ssl ? "?sslmode=require" : "";
		const passwordPart = password ? `:${password}` : "";
		return `postgres://${user}${passwordPart}@${host}:${port}/${database}${sslParam}`;
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const connStr =
			mode === "string" ? connectionString : buildConnectionString();
		onConnect(connStr, name || undefined);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<Tabs value={mode} onValueChange={(v) => setMode(v as "string" | "fields")}>
				<TabsList className="w-full">
					<TabsTrigger value="string" className="flex-1">Connection string</TabsTrigger>
					<TabsTrigger value="fields" className="flex-1">Individual fields</TabsTrigger>
				</TabsList>
			</Tabs>

			{mode === "string" ? (
				<div className="space-y-2">
					<Label htmlFor="connection-string">Connection string</Label>
					<div className="relative">
						<Input
							id="connection-string"
							type={showConnStr ? "text" : "password"}
							placeholder="postgres://user:password@host:5432/database"
							value={connectionString}
							onChange={(e) => setConnectionString(e.target.value)}
							className="font-mono text-sm pr-9"
							autoFocus
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
							onClick={() => setShowConnStr(!showConnStr)}
						>
							{showConnStr ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
						</Button>
					</div>
				</div>
			) : (
				<div className="grid gap-3">
					<div className="grid grid-cols-[1fr_100px] gap-3">
						<div className="space-y-2">
							<Label htmlFor="host">Host</Label>
							<Input
								id="host"
								placeholder="localhost"
								value={host}
								onChange={(e) => setHost(e.target.value)}
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="port">Port</Label>
							<Input
								id="port"
								placeholder="5432"
								value={port}
								onChange={(e) => setPort(e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="database">Database</Label>
						<Input
							id="database"
							placeholder="mydb"
							value={database}
							onChange={(e) => setDatabase(e.target.value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="user">User</Label>
							<Input
								id="user"
								placeholder="postgres"
								value={user}
								onChange={(e) => setUser(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="pr-9"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
									onClick={() => setShowPassword(!showPassword)}
								>
									{showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
								</Button>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Switch id="ssl" checked={ssl} onCheckedChange={setSsl} />
						<Label htmlFor="ssl" className="text-sm font-normal cursor-pointer">
							Require SSL
						</Label>
					</div>
				</div>
			)}

			<Separator />

			<div className="space-y-2">
				<Label htmlFor="conn-name">Connection name (optional)</Label>
				<Input
					id="conn-name"
					placeholder="My local database"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					Save this connection for quick access later
				</p>
			</div>

			<Button type="submit" className="w-full" disabled={isConnecting}>
				{isConnecting ? "Connecting..." : "Connect"}
			</Button>
		</form>
	);
}
