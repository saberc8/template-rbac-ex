import apiClient from "../apiClient";

import type { UserInfo, UserToken } from "#/entity";

export interface SignUpReq {
	username: string;
	email: string;
	password: string;
}
export type SignUpRes = UserToken & { user: UserInfo };

export enum UserApi {
	SignUp = "/auth/signup",
	Logout = "/auth/logout",
	Refresh = "/auth/refresh",
	User = "/user",
}

const signup = (data: SignUpReq) => apiClient.post<SignUpRes>({ url: UserApi.SignUp, data });
const logout = () => apiClient.get({ url: UserApi.Logout });
const findById = (id: string) => apiClient.get<UserInfo[]>({ url: `${UserApi.User}/${id}` });

export default {
	signup,
	findById,
	logout,
};
