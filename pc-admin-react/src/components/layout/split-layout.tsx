import type { ReactNode } from "react";

import { cn } from "@/utils";

export default function SplitLayout({
	left,
	right,
	leftWidth = 280,
	className,
}: {
	left: ReactNode;
	right: ReactNode;
	leftWidth?: number;
	className?: string;
}) {
	return (
		<div
			className={cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[var(--split-left)_1fr]", className)}
			style={
				{
					"--split-left": `${Math.max(200, Number(leftWidth) || 280)}px`,
				} as any
			}
		>
			<div className="min-w-0">{left}</div>
			<div className="min-w-0">{right}</div>
		</div>
	);
}
