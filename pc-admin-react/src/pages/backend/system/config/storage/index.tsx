// 后端路由页面：系统管理-存储配置（复用 SystemConfig 容器，tab=storage）。

import type { BackendRouteItem } from "#/backend";

import BackendSystemConfigPage from "@/pages/backend/system/config";

export default function BackendSystemConfigStoragePage({ route }: { route?: BackendRouteItem }) {
	return <BackendSystemConfigPage route={route} initialTab="storage" />;
}
