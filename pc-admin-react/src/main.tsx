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
import { useSiteConfigStore } from "./store/siteConfigStore";
import userStore from "./store/userStore";

await registerLocalIcons();

try {
	await useSiteConfigStore.getState().actions.initSiteConfig();
} catch {
	// best-effort: 登录页站点配置接口异常时允许回退到默认值
}

const token = userStore.getState().userToken.accessToken;
const path = typeof window !== "undefined" ? window.location.pathname : "";
const isLoginPage = /\/auth\/login\b/.test(path) || /\/login\b/.test(path);

// 登录页（未登录态）只允许请求开放接口（如 /common/dict/option/site），避免无 token 请求菜单。
if (token && !isLoginPage) {
	try {
		await useMenuStore.getState().actions.initBackendMenuTree();
	} catch (e) {
		useMenuStore.getState().actions.clearBackendMenuTree();
		console.warn("Failed to init backend menu tree.", e);
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
