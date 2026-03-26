import { Button } from "@client/components/ui/button";
import { Calendar } from "@client/components/ui/calendar";
import { ScrollArea } from "@client/components/ui/scroll-area";
import { Separator } from "@client/components/ui/separator";
import { cn } from "@client/lib/utils";
import { useEffect, useRef, useState } from "react";

interface TimestampEditorProps {
	value: string;
	onChange: (value: string) => void;
	onSetNull: () => void;
}

function parseTimestamp(val: string): {
	date: Date;
	hours: number;
	minutes: number;
	seconds: number;
} {
	try {
		const d = new Date(val);
		if (Number.isNaN(d.getTime())) throw new Error();
		return {
			date: d,
			hours: d.getHours(),
			minutes: d.getMinutes(),
			seconds: d.getSeconds(),
		};
	} catch {
		const now = new Date();
		return {
			date: now,
			hours: now.getHours(),
			minutes: now.getMinutes(),
			seconds: now.getSeconds(),
		};
	}
}

function formatTimestamp(
	date: Date,
	hours: number,
	minutes: number,
	seconds: number,
): string {
	const y = date.getFullYear();
	const m = padTwo(date.getMonth() + 1);
	const d = padTwo(date.getDate());
	return `${y}-${m}-${d} ${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

function padTwo(n: number) {
	return String(n).padStart(2, "0");
}

export function TimestampEditor({
	value,
	onChange,
	onSetNull,
}: TimestampEditorProps) {
	const parsed = parseTimestamp(value);
	const [selectedDate, setSelectedDate] = useState<Date>(parsed.date);
	const [hours, setHours] = useState(parsed.hours);
	const [minutes, setMinutes] = useState(parsed.minutes);
	const [seconds, setSeconds] = useState(parsed.seconds);

	const hoursRef = useRef<HTMLDivElement>(null);
	const minutesRef = useRef<HTMLDivElement>(null);
	const secondsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		onChange(formatTimestamp(selectedDate, hours, minutes, seconds));
	}, [selectedDate, hours, minutes, seconds]);

	// Scroll active items into view
	useEffect(() => {
		for (const [ref, val] of [
			[hoursRef, hours],
			[minutesRef, minutes],
			[secondsRef, seconds],
		] as const) {
			const el = ref.current?.querySelector(`[data-value="${val}"]`);
			el?.scrollIntoView({ block: "center" });
		}
	}, []);

	function setQuickValue(type: "now" | "today" | "tomorrow" | "yesterday") {
		const now = new Date();
		let d: Date;
		switch (type) {
			case "now":
				d = now;
				setHours(d.getHours());
				setMinutes(d.getMinutes());
				setSeconds(d.getSeconds());
				break;
			case "today":
				d = now;
				setHours(0);
				setMinutes(0);
				setSeconds(0);
				break;
			case "tomorrow":
				d = new Date(now);
				d.setDate(d.getDate() + 1);
				setHours(0);
				setMinutes(0);
				setSeconds(0);
				break;
			case "yesterday":
				d = new Date(now);
				d.setDate(d.getDate() - 1);
				setHours(0);
				setMinutes(0);
				setSeconds(0);
				break;
		}
		setSelectedDate(d);
	}

	return (
		<div className="flex">
			{/* Quick values */}
			<div className="flex flex-col gap-0.5 p-2 text-xs border-r">
				<button
					type="button"
					onClick={onSetNull}
					className="text-left px-2 py-1 hover:bg-accent text-muted-foreground"
				>
					NULL
				</button>
				{(["now", "today", "tomorrow", "yesterday"] as const).map((q) => (
					<button
						key={q}
						type="button"
						onClick={() => setQuickValue(q)}
						className="text-left px-2 py-1 hover:bg-accent"
					>
						{q}
					</button>
				))}
			</div>

			{/* Calendar */}
			<div className="border-r">
				<Calendar
					mode="single"
					selected={selectedDate}
					onSelect={(d) => d && setSelectedDate(d)}
					className="p-2"
				/>
			</div>

			{/* Time scrollers */}
			<div className="flex">
				<TimeScroller
					ref={hoursRef}
					values={Array.from({ length: 24 }, (_, i) => i)}
					selected={hours}
					onSelect={setHours}
				/>
				<TimeScroller
					ref={minutesRef}
					values={Array.from({ length: 60 }, (_, i) => i)}
					selected={minutes}
					onSelect={setMinutes}
				/>
				<TimeScroller
					ref={secondsRef}
					values={Array.from({ length: 60 }, (_, i) => i)}
					selected={seconds}
					onSelect={setSeconds}
				/>
			</div>
		</div>
	);
}

interface TimeScrollerProps {
	values: number[];
	selected: number;
	onSelect: (v: number) => void;
}

import { forwardRef } from "react";

const TimeScroller = forwardRef<HTMLDivElement, TimeScrollerProps>(
	({ values, selected, onSelect }, ref) => {
		return (
			<ScrollArea className="h-[280px] w-10" ref={ref}>
				<div className="flex flex-col items-center py-2 gap-0.5">
					{values.map((v) => (
						<button
							key={v}
							type="button"
							data-value={v}
							onClick={() => onSelect(v)}
							className={cn(
								"w-8 h-7 text-xs font-mono flex items-center justify-center transition-colors",
								v === selected
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-muted-foreground",
							)}
						>
							{padTwo(v)}
						</button>
					))}
				</div>
			</ScrollArea>
		);
	},
);
