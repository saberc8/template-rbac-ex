import apiClient from "../apiClient";

export type LoginReq = {
	clientId: string;
	authType: "ACCOUNT";
	username: string;
	password: string;
	captcha?: string;
	uuid?: string;
};

export type LoginResp = {
	token: string;
	userId: number;
	username: string;
	nickname?: string;
};

export type UserInfoResp = {
	id: number;
	username: string;
	nickname?: string;
	email?: string;
	phone?: string;
	avatar?: string;
	roles?: string[];
	permissions?: string[];
};

export const authService = {
	login: (data: LoginReq) => apiClient.post<LoginResp>({ url: "/auth/login", data }),
	logout: () => apiClient.post({ url: "/auth/logout" }),
	getUserInfo: () => apiClient.get<UserInfoResp>({ url: "/auth/user/info" }),
};
