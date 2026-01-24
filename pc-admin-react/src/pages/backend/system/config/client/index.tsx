// 后端路由页面：系统管理-客户端配置（复用 SystemConfig 容器，tab=client）。

import type { BackendRouteItem } from "#/backend";

import BackendSystemConfigPage from "@/pages/backend/system/config";

export default function BackendSystemConfigClientPage({ route }: { route?: BackendRouteItem }) {
	return <BackendSystemConfigPage route={route} initialTab="client" />;
}
