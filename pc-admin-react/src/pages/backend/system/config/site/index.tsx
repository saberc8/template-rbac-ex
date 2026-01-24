// 后端路由页面：系统管理-网站配置（复用 SystemConfig 容器，tab=site）。

import type { BackendRouteItem } from "#/backend";

import BackendSystemConfigPage from "@/pages/backend/system/config";

export default function BackendSystemConfigSitePage({ route }: { route?: BackendRouteItem }) {
	return <BackendSystemConfigPage route={route} initialTab="site" />;
}
