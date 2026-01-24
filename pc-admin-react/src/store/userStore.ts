import { useMutation } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import menuService from "@/api/services/menuService";
import userService from "@/api/services/userService";
import { GLOBAL_CONFIG } from "@/global-config";
import { useRouteActions } from "@/store/routeStore";

import type { AccountLoginReq, BackendUserInfo } from "#/backend";
import { StorageEnum } from "#/enum";

type UserStore = {
	userInfo: Partial<BackendUserInfo>;
	userToken: {
		accessToken?: string;
	};

	actions: {
		setUserInfo: (userInfo: BackendUserInfo) => void;
		setUserToken: (token: UserStore["userToken"]) => void;
		clearUserInfoAndToken: () => void;
	};
};

const useUserStore = create<UserStore>()(
	persist(
		(set) => ({
			userInfo: {},
			userToken: {},
			actions: {
				setUserInfo: (userInfo) => {
					set({ userInfo });
				},
				setUserToken: (userToken) => {
					set({ userToken });
				},
				clearUserInfoAndToken() {
					set({ userInfo: {}, userToken: {} });
				},
			},
		}),
		{
			name: "userStore", // name of the item in the storage (must be unique)
			storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
			partialize: (state) => ({
				[StorageEnum.UserInfo]: state.userInfo,
				[StorageEnum.UserToken]: state.userToken,
			}),
		},
	),
);

export const useUserInfo = () => useUserStore((state) => state.userInfo);
export const useUserToken = () => useUserStore((state) => state.userToken);
export const useUserPermissions = () => useUserStore((state) => state.userInfo.permissions || []);
export const useUserRoles = () => useUserStore((state) => state.userInfo.roles || []);
export const useUserActions = () => useUserStore((state) => state.actions);

export const useSignIn = () => {
	const { setUserToken, setUserInfo } = useUserActions();
	const { setRoutes, clearRoutes } = useRouteActions();

	const signInMutation = useMutation({
		mutationFn: userService.login,
	});

	const signIn = async (data: Omit<AccountLoginReq, "clientId" | "authType">) => {
		try {
			const loginResp = await signInMutation.mutateAsync({
				...data,
				clientId: GLOBAL_CONFIG.clientId,
				authType: "ACCOUNT",
			});
			setUserToken({ accessToken: loginResp.token });

			const userInfo = await userService.getUserInfo();
			setUserInfo(userInfo);

			if (GLOBAL_CONFIG.routerMode === "backend") {
				const routes = await menuService.getUserRoute();
				setRoutes(routes);
			} else {
				clearRoutes();
			}
		} catch (err) {
			throw err;
		}
	};

	return signIn;
};

export default useUserStore;
