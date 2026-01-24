// 缺失页面兜底：用于后端路由 component 未迁移完成时的占位展示。

import { Card, CardContent, CardHeader } from "@/ui/card";
import { useLocation } from "react-router";

type MissingPageProps = {
	componentPath: string;
	route?: {
		title?: string;
		path?: string;
		component?: string;
	};
};

export default function MissingPage({ componentPath, route }: MissingPageProps) {
	const location = useLocation();
	const routeInfo = route || {};

	return (
		<div className="w-full">
			<Card>
				<CardHeader>
					<div className="text-base font-semibold">页面未迁移（占位）</div>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-text-secondary">
					<div>当前地址：{`${location.pathname}${location.search}`}</div>
					<div>组件路径：{componentPath}</div>
					{routeInfo.title ? <div>菜单标题：{routeInfo.title}</div> : null}
					{routeInfo.component ? <div>后端 component：{routeInfo.component}</div> : null}
					{routeInfo.path ? <div>后端 path：{routeInfo.path}</div> : null}
				</CardContent>
			</Card>
		</div>
	);
}

