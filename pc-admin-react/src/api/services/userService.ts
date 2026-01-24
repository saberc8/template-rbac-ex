import apiClient from "../apiClient";

import type { AccountLoginReq, BackendUserInfo, LoginResp } from "#/backend";

export enum UserApi {
	Login = "/auth/login",
	Logout = "/auth/logout",
	UserInfo = "/auth/user/info",
}

const login = (data: AccountLoginReq) => apiClient.post<LoginResp>({ url: UserApi.Login, data });
const logout = () => apiClient.post<boolean>({ url: UserApi.Logout });
const getUserInfo = () => apiClient.get<BackendUserInfo>({ url: UserApi.UserInfo });

export default {
	login,
	getUserInfo,
	logout,
};
