import type { RouteObject } from "react-router";
import BackendRouteView from "@/routes/components/backend-route-view";

export function getBackendDashboardRoutes() {
	const backendDashboardRoutes: RouteObject[] = [
		{ path: "system/*", element: <BackendRouteView /> },
		{ path: "monitor/*", element: <BackendRouteView /> },
	];
	return backendDashboardRoutes;
}
