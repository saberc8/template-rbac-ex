// 系统管理-左侧统一列表：用于收敛 Tree/Menu/Table 的视觉与交互，保持所有页面同一套 UI。

import type { ReactNode } from "react";

import { cn } from "@/utils";

export type SystemSideListItemKey = string | number;

export type SystemSideListItem = {
	key: SystemSideListItemKey;
	title: ReactNode;
	subtitle?: ReactNode;
	right?: ReactNode;
	depth?: number;
	disabled?: boolean;
};

export default function SystemSideList({
	items,
	selectedKey,
	onSelect,
	empty,
	className,
}: {
	items: SystemSideListItem[];
	selectedKey?: SystemSideListItemKey | null;
	onSelect?: (key: SystemSideListItemKey) => void;
	empty?: ReactNode;
	className?: string;
}) {
	if (!items.length) {
		return <div className={cn("text-sm text-muted-foreground", className)}>{empty ?? "暂无数据"}</div>;
	}

	return (
		<div className={cn("max-h-[520px] overflow-auto", className)}>
			<div className="flex flex-col gap-1">
				{items.map((it) => {
					const active = selectedKey != null && String(it.key) === String(selectedKey);
					const depth = Math.max(0, Number(it.depth) || 0);
					const disabled = Boolean(it.disabled) || !onSelect;
					const hasSubtitle = Boolean(it.subtitle);
					return (
						<div
							key={String(it.key)}
							className={cn(
								"group flex justify-between gap-2 rounded-md px-2 py-2 transition-colors",
								hasSubtitle ? "items-start" : "items-center",
								!disabled && "hover:bg-muted/60",
								disabled && "opacity-60 cursor-not-allowed",
								active && "bg-muted",
							)}
						>
							<button
								type="button"
								disabled={disabled}
								onClick={() => onSelect?.(it.key)}
								className={cn(
									"flex flex-1 min-w-0 text-left disabled:cursor-not-allowed",
									hasSubtitle ? "items-start" : "items-center",
								)}
							>
								<div className="min-w-0" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
									<div className="text-sm font-medium truncate">{it.title}</div>
									{it.subtitle ? (
										<div className="mt-0.5 text-xs text-muted-foreground truncate">{it.subtitle}</div>
									) : null}
								</div>
							</button>

							{it.right ? (
								<div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">{it.right}</div>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}
