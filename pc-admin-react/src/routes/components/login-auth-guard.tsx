import menuService from "@/api/services/menuService";
import userService from "@/api/services/userService";
import { LineLoading } from "@/components/loading";
import { GLOBAL_CONFIG } from "@/global-config";
import { useBackendRoutes, useRouteActions } from "@/store/routeStore";
import { useUserActions, useUserInfo, useUserToken } from "@/store/userStore";
import { useEffect } from "react";
import { Navigate } from "react-router";

type Props = {
	children: React.ReactNode;
};
export default function LoginAuthGuard({ children }: Props) {
	const { accessToken } = useUserToken();
	const userInfo = useUserInfo();
	const routes = useBackendRoutes();
	const { setUserInfo, clearUserInfoAndToken } = useUserActions();
	const { setRoutes, clearRoutes } = useRouteActions();

	const needUserInfo = Boolean(accessToken) && !userInfo.id;
	const needRoutes = Boolean(accessToken) && GLOBAL_CONFIG.routerMode === "backend" && routes.length === 0;
	const needsBootstrap = needUserInfo || needRoutes;

	useEffect(() => {
		if (!needsBootstrap) return;

		let cancelled = false;
		(async () => {
			try {
				if (needUserInfo) {
					const info = await userService.getUserInfo();
					if (!cancelled) setUserInfo(info);
				}
				if (needRoutes) {
					const tree = await menuService.getUserRoute();
					if (!cancelled) setRoutes(tree);
				}
			} catch (err) {
				clearUserInfoAndToken();
				clearRoutes();
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [needsBootstrap]);

	if (!accessToken) {
		return <Navigate to="/auth/login" replace />;
	}
	if (needsBootstrap) {
		return <LineLoading />;
	}
	return <>{children}</>;
}
