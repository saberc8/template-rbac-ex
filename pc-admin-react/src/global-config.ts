import packageJson from "../package.json";

/**
 * Global application configuration type definition
 */
export type GlobalConfig = {
	/** Application name */
	appName: string;
	/** Application version number */
	appVersion: string;
	/** Default route path for the application */
	defaultRoute: string;
	/** Public path for static assets */
	publicPath: string;
	/** Base URL for API endpoints */
	apiBaseUrl: string;
	/** Client id used by backend auth */
	clientId: string;
	/** Routing mode: frontend routing or backend routing */
	routerMode: "frontend" | "backend";
	/** Target admin menu dataset: vue3/react (backend-python sys_menu.frontend selection) */
	adminFrontendType: "vue3" | "react";
};

/**
 * Global configuration constants
 * Reads configuration from environment variables and package.json
 *
 * @warning
 * Please don't use the import.meta.env to get the configuration, use the GLOBAL_CONFIG instead
 */
export const GLOBAL_CONFIG: GlobalConfig = {
	appName: "Slash Admin",
	appVersion: packageJson.version,
	defaultRoute: import.meta.env.VITE_APP_DEFAULT_ROUTE || "/workbench",
	publicPath: import.meta.env.VITE_APP_PUBLIC_PATH || "/",
	apiBaseUrl: import.meta.env.VITE_APP_API_BASE_URL || "/api",
	clientId: import.meta.env.VITE_CLIENT_ID || import.meta.env.VITE_APP_CLIENT_ID || "",
	routerMode: import.meta.env.VITE_APP_ROUTER_MODE || "frontend",
	adminFrontendType:
		(import.meta.env.VITE_APP_ADMIN_FRONTEND_TYPE || "react").toLowerCase() === "vue3" ? "vue3" : "react",
};
