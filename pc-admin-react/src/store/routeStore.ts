// 后端路由树（/auth/user/route）持久化缓存，用于后端路由模式的导航与页面渲染。

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { BackendRouteItem } from "#/backend";

type RouteStore = {
	routes: BackendRouteItem[];

	actions: {
		setRoutes: (routes: BackendRouteItem[]) => void;
		clearRoutes: () => void;
	};
};

const useRouteStore = create<RouteStore>()(
	persist(
		(set) => ({
			routes: [],
			actions: {
				setRoutes: (routes) => set({ routes }),
				clearRoutes: () => set({ routes: [] }),
			},
		}),
		{
			name: "routeStore",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ routes: state.routes }),
		},
	),
);

export const useBackendRoutes = () => useRouteStore((state) => state.routes);
export const useRouteActions = () => useRouteStore((state) => state.actions);

export default useRouteStore;

