// 后端路由页面：系统管理-安全配置（复用 SystemConfig 容器，tab=security）。

import type { BackendRouteItem } from "#/backend";

import BackendSystemConfigPage from "@/pages/backend/system/config";

export default function BackendSystemConfigSecurityPage({ route }: { route?: BackendRouteItem }) {
	return <BackendSystemConfigPage route={route} initialTab="security" />;
}
