// 系统管理-左侧统一卡片：用于收敛双栏布局页面左侧面板的标题/工具栏/内容样式。

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/ui/card";
import { cn } from "@/utils";

export default function SystemSideCard({
	title,
	extra,
	toolbar,
	children,
	className,
	headerClassName,
	contentClassName,
}: {
	title: ReactNode;
	extra?: ReactNode;
	toolbar?: ReactNode;
	children: ReactNode;
	className?: string;
	headerClassName?: string;
	contentClassName?: string;
}) {
	return (
		<Card className={cn("min-w-0", className)}>
			<CardHeader className={cn("pb-2", headerClassName)}>
				<div className="flex items-center justify-between gap-2 min-w-0">
					<div className="text-base font-medium truncate">{title}</div>
					{extra ? <div className="shrink-0">{extra}</div> : null}
				</div>
				{toolbar ? <div className="mt-2 flex flex-wrap items-center gap-2">{toolbar}</div> : null}
			</CardHeader>
			<CardContent className={cn("min-w-0", contentClassName)}>{children}</CardContent>
		</Card>
	);
}
