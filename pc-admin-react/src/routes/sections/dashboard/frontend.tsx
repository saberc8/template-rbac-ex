import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { Component } from "./utils";

export function getFrontendDashboardRoutes(): RouteObject[] {
	const frontendDashboardRoutes: RouteObject[] = [
		{ path: "workbench", element: Component("/pages/dashboard/workbench") },
		{ path: "analysis", element: Component("/pages/dashboard/analysis") },
		{
			path: "management",
			children: [
				{ index: true, element: <Navigate to="user" replace /> },
				{
					path: "user",
					children: [
						{ index: true, element: <Navigate to="profile" replace /> },
						{ path: "profile", element: Component("/pages/management/user/profile") },
					],
				},
				{
					path: "system",
					children: [
						{ index: true, element: <Navigate to="menu" replace /> },
						{ path: "client", element: Component("/pages/management/system/client") },
						{ path: "dept", element: Component("/pages/management/system/dept") },
						{ path: "option", element: Component("/pages/management/system/option") },
						{ path: "file", element: Component("/pages/management/system/file") },
						{ path: "menu", element: Component("/pages/management/system/menu") },
						{ path: "role", element: Component("/pages/management/system/role") },
						{ path: "storage", element: Component("/pages/management/system/storage") },
						{ path: "user", element: Component("/pages/management/system/user") },
						{ path: "user/:id", element: Component("/pages/management/system/user/detail") },
						{ path: "dict", element: Component("/pages/management/system/dict") },
					],
				},
				{
					path: "monitor",
					children: [
						{ index: true, element: <Navigate to="online" replace /> },
						{ path: "online", element: Component("/pages/management/monitor/online") },
						{ path: "log", element: Component("/pages/management/monitor/log") },
					],
				},
			],
		},
		{
			path: "error",
			children: [
				{ index: true, element: <Navigate to="403" replace /> },
				{ path: "403", element: Component("/pages/sys/error/Page403") },
				{ path: "404", element: Component("/pages/sys/error/Page404") },
				{ path: "500", element: Component("/pages/sys/error/Page500") },
			],
		},
	];
	return frontendDashboardRoutes;
}
