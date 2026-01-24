// 后端路由入口页面：根据 /auth/user/route 返回的 RouteItem 查找并加载对应页面组件。

import { Navigate, useLocation } from "react-router";

import { Component } from "@/routes/sections/dashboard/utils";
import { useBackendRoutes } from "@/store/routeStore";
import { flattenTrees } from "@/utils/tree";

const isLayoutComponent = (component?: string) => component === "Layout" || component === "ParentView";

const resolveBackendComponentPath = (component: string) => {
	if (!component || isLayoutComponent(component)) return "";
	if (component.startsWith("/")) return component;
	return `/pages/backend/${component}`;
};

export default function BackendRouteView() {
	const location = useLocation();
	const routes = useBackendRoutes();

	if (!routes.length) {
		return <Navigate to="/auth/login" replace />;
	}

	const fullPath = `${location.pathname}${location.search}`;
	const all = flattenTrees(routes);
	const current = all.find((item) => item.path === fullPath) || all.find((item) => item.path === location.pathname);

	if (!current) {
		return <Navigate to="/404" replace />;
	}

	// 目录节点：优先使用后端 redirect，否则退化到第一个子节点。
	if (current.type === 1) {
		const target = current.redirect || current.children?.[0]?.path;
		return target ? <Navigate to={target} replace /> : <Navigate to="/404" replace />;
	}

	const componentPath = resolveBackendComponentPath(current.component);
	if (!componentPath) {
		return <Navigate to="/404" replace />;
	}

	return <>{Component(componentPath, { route: current })}</>;
}

