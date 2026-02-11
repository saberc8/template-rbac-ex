import { MoreHorizontalIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";

export type OperationActionItem = {
	key: string;
	label: string;
	onClick: () => void | Promise<void>;
	disabled?: boolean;
	title?: string;
	variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
	menuVariant?: "default" | "destructive";
	hidden?: boolean;
};

export default function OperationActions({
	items,
	maxVisible = 3,
}: {
	items: OperationActionItem[];
	maxVisible?: number;
}) {
	const effectiveItems = useMemo(() => items.filter((it) => !it.hidden), [items]);
	const visibleItems = effectiveItems.slice(0, Math.max(0, maxVisible));
	const overflowItems = effectiveItems.slice(Math.max(0, maxVisible));

	const [open, setOpen] = useState(false);
	const closeTimerRef = useRef<number | null>(null);

	const clearCloseTimer = () => {
		if (closeTimerRef.current == null) return;
		window.clearTimeout(closeTimerRef.current);
		closeTimerRef.current = null;
	};

	const scheduleClose = () => {
		clearCloseTimer();
		closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
	};

	if (!effectiveItems.length) return null;

	return (
		<div className="flex items-center justify-center gap-1">
			{visibleItems.map((it) => (
				<Button
					key={it.key}
					size="sm"
					variant={it.variant ?? "secondary"}
					disabled={it.disabled}
					title={it.title}
					onClick={it.onClick}
				>
					{it.label}
				</Button>
			))}

			{overflowItems.length ? (
				<DropdownMenu open={open} onOpenChange={setOpen}>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onMouseEnter={() => {
								clearCloseTimer();
								setOpen(true);
							}}
							onMouseLeave={() => {
								scheduleClose();
							}}
							aria-label="更多操作"
						>
							<MoreHorizontalIcon className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onMouseEnter={() => {
							clearCloseTimer();
						}}
						onMouseLeave={() => {
							scheduleClose();
						}}
					>
						{overflowItems.map((it) => (
							<DropdownMenuItem
								key={it.key}
								disabled={it.disabled}
								title={it.title}
								variant={it.menuVariant ?? (it.variant === "destructive" ? "destructive" : "default")}
								onSelect={() => {
									void it.onClick();
								}}
							>
								{it.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}
