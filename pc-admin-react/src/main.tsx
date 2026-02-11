import "./global.css";
import "./theme/theme.css";
import "./locales/i18n";
import "./shims/apexcharts";
import ReactDOM from "react-dom/client";
import { Outlet, RouterProvider, createBrowserRouter } from "react-router";
import App from "./App";
import { registerLocalIcons } from "./components/icon";
import { GLOBAL_CONFIG } from "./global-config";
import ErrorBoundary from "./routes/components/error-boundary";
import { buildRoutesSection } from "./routes/sections";
import { useMenuStore } from "./store/menuStore";

await registerLocalIcons();

if (GLOBAL_CONFIG.routerMode === "backend") {
	try {
		await useMenuStore.getState().actions.initBackendMenuTree();
	} catch (e) {
		useMenuStore.getState().actions.clearBackendMenuTree();
		console.warn("Failed to init backend menu tree, fallback to local menu snapshot.", e);
	}
}

const routesSection = buildRoutesSection();

const router = createBrowserRouter(
	[
		{
			Component: () => (
				<App>
					<Outlet />
				</App>
			),
			errorElement: <ErrorBoundary />,
			children: routesSection,
		},
	],
	{
		basename: GLOBAL_CONFIG.publicPath,
	},
);

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<RouterProvider router={router} />);
