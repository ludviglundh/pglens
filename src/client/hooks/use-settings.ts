import { useCallback, useState } from "react";

interface Settings {
	showEnums: boolean;
}

const STORAGE_KEY = "pglens:settings";

function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? { showEnums: true, ...JSON.parse(raw) } : { showEnums: true };
	} catch {
		return { showEnums: true };
	}
}

export function useSettings() {
	const [settings, setSettingsState] = useState<Settings>(loadSettings);

	const updateSettings = useCallback((patch: Partial<Settings>) => {
		setSettingsState((prev) => {
			const next = { ...prev, ...patch };
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			return next;
		});
	}, []);

	return { settings, updateSettings };
}
