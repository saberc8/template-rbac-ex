import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { Component } from "./utils";

export function getFrontendDashboardRoutes(): RouteObject[] {
	const frontendDashboardRoutes: RouteObject[] = [
		{ path: "workbench", element: Component("/pages/dashboard/workbench") },
		{ path: "analysis", element: Component("/pages/dashboard/analysis") },
		{
			path: "components",
			children: [
				{ index: true, element: <Navigate to="animate" replace /> },
				{ path: "animate", element: Component("/pages/components/animate") },
				{ path: "scroll", element: Component("/pages/components/scroll") },
				{ path: "multi-language", element: Component("/pages/components/multi-language") },
				{ path: "icon", element: Component("/pages/components/icon") },
				{ path: "upload", element: Component("/pages/components/upload") },
				{ path: "chart", element: Component("/pages/components/chart") },
				{ path: "toast", element: Component("/pages/components/toast") },
			],
		},
		{
			path: "functions",
			children: [
				{ index: true, element: <Navigate to="clipboard" replace /> },
				{ path: "clipboard", element: Component("/pages/functions/clipboard") },
				{ path: "token_expired", element: Component("/pages/functions/token-expired") },
			],
		},
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
						{ index: true, element: <Navigate to="permission" replace /> },
						{ path: "client", element: Component("/pages/management/system/client") },
						{ path: "organization", element: Component("/pages/management/system/organization") },
						{ path: "option", element: Component("/pages/management/system/option") },
						{ path: "file", element: Component("/pages/management/system/file") },
						{ path: "permission", element: Component("/pages/management/system/permission") },
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
