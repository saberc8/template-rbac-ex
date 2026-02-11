import { useMutation } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { authService } from "@/api/services/authService";
import { GLOBAL_CONFIG } from "@/global-config";

import { toast } from "sonner";
import type { UserInfo, UserToken } from "#/entity";
import { StorageEnum } from "#/enum";

type UserStore = {
	userInfo: Partial<UserInfo>;
	userToken: UserToken;

	actions: {
		setUserInfo: (userInfo: UserInfo) => void;
		updateUserInfo: (patch: Partial<UserInfo>) => void;
		setUserToken: (token: UserToken) => void;
		clearUserInfoAndToken: () => void;
		refreshUserInfo: () => Promise<void>;
	};
};

type AuthUserInfo = Awaited<ReturnType<typeof authService.getUserInfo>>;

const mapAuthUserInfoToUserInfo = (info: AuthUserInfo): UserInfo => {
	const roles = (info.roles || []).map((code) => ({ id: code, name: code, code }));
	const permissions = (info.permissions || []).map((code) => ({ id: code, name: code, code }));
	return {
		id: String(info.id),
		username: info.username,
		email: info.email || "",
		phone: info.phone || "",
		nickname: info.nickname || "",
		gender: info.gender ?? 0,
		avatar: info.avatar || "",
		description: info.description || "",
		pwdResetTime: info.pwdResetTime || "",
		pwdExpired: info.pwdExpired ?? false,
		registrationDate: info.registrationDate || "",
		deptName: info.deptName || "",
		roles,
		permissions,
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
				updateUserInfo: (patch) => {
					set((state) => ({ userInfo: { ...state.userInfo, ...patch } }));
				},
				setUserToken: (userToken) => {
					set({ userToken });
				},
				clearUserInfoAndToken() {
					set({ userInfo: {}, userToken: {} });
				},
				refreshUserInfo: async () => {
					const info = await authService.getUserInfo();
					set({ userInfo: mapAuthUserInfoToUserInfo(info) });
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

	const signInMutation = useMutation({
		mutationFn: authService.login,
	});

	const signIn = async (data: { username: string; password: string; captcha?: string; uuid?: string }) => {
		try {
			if (!GLOBAL_CONFIG.clientId) {
				throw new Error("Missing client id");
			}

			const loginResp = await signInMutation.mutateAsync({
				clientId: GLOBAL_CONFIG.clientId,
				authType: "ACCOUNT",
				username: data.username,
				password: data.password,
				captcha: data.captcha,
				uuid: data.uuid,
			});

			const token = loginResp.token;
			setUserToken({ accessToken: token, refreshToken: token });

			try {
				const info = await authService.getUserInfo();
				setUserInfo(mapAuthUserInfoToUserInfo(info));
			} catch (e) {
				setUserToken({});
				throw e;
			}
		} catch (err: any) {
			toast.error(err?.message || "Login failed", {
				position: "top-center",
			});
			throw err;
		}
	};

	return signIn;
};

export default useUserStore;
