// 后端路由页面占位组件：用于逐步迁移业务页面时保持“可访问”。

import type { BackendRouteItem } from "#/backend";
import { useLocation } from "react-router";

import { Card, CardContent, CardHeader } from "@/ui/card";

type BackendPlaceholderProps = {
	title: string;
	route?: BackendRouteItem;
};

export default function BackendPlaceholder({ title, route }: BackendPlaceholderProps) {
	const location = useLocation();
	const currentPath = `${location.pathname}${location.search}`;

	return (
		<Card>
			<CardHeader>
				<div className="text-base font-semibold">{title}</div>
			</CardHeader>
			<CardContent className="space-y-2 text-sm text-text-secondary">
				<div>当前地址：{currentPath}</div>
				{route?.component ? <div>后端 component：{route.component}</div> : null}
				{route?.permission ? <div>权限码：{route.permission}</div> : null}
				<div className="pt-2 text-text-tertiary">说明：这是占位页，可在后续迁移中替换为真实业务实现。</div>
			</CardContent>
		</Card>
	);
}

