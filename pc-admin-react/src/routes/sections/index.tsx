import { Navigate, type RouteObject } from "react-router";
import { authRoutes } from "./auth";
import { buildDashboardRoutes } from "./dashboard";
import { mainRoutes } from "./main";

export const buildRoutesSection = (): RouteObject[] => [
	// Auth
	...authRoutes,
	// Alias
	{ path: "login", element: <Navigate to="/auth/login" replace /> },
	// Dashboard
	...buildDashboardRoutes(),
	// Main
	...mainRoutes,
	// No Match
	{ path: "*", element: <Navigate to="/404" replace /> },
];
