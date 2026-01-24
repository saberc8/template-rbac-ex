// 后端路由页面：系统管理-登录配置（复用 SystemConfig 容器，tab=login）。

import type { BackendRouteItem } from "#/backend";

import BackendSystemConfigPage from "@/pages/backend/system/config";

export default function BackendSystemConfigLoginPage({ route }: { route?: BackendRouteItem }) {
	return <BackendSystemConfigPage route={route} initialTab="login" />;
}
