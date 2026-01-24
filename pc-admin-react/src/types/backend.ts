// 后端（backend-go/backend-python）接口类型定义：与 pc-admin-vue3 对齐。

export type AuthType = "ACCOUNT" | "EMAIL" | "SOCIAL";

export interface AuthReq {
	clientId?: string;
	authType?: AuthType;
}

export interface AccountLoginReq extends AuthReq {
	username: string;
	password: string;
	captcha?: string;
	uuid?: string;
}

export interface LoginResp {
	token: string;
	userId?: number;
	username?: string;
	nickname?: string;
}

export interface ImageCaptchaResp {
	uuid: string;
	img: string;
	expireTime: number;
	isEnabled: boolean;
}

export interface BackendUserInfo {
	id: number;
	username: string;
	nickname: string;
	gender: 0 | 1 | 2;
	email: string;
	phone: string;
	avatar: string;
	description: string;
	pwdResetTime: string;
	pwdExpired: boolean;
	registrationDate: string;
	deptName: string;
	roles: string[];
	permissions: string[];
}

export interface BackendRouteItem {
	id: number;
	title: string;
	parentId: number;
	type: 1 | 2 | 3;
	path: string;
	name: string;
	component: string;
	redirect: string;
	icon: string;
	isExternal: boolean;
	isHidden: boolean;
	isCache: boolean;
	permission: string;
	roles: string[];
	sort: number;
	status: 0 | 1;
	children: BackendRouteItem[];
	activeMenu: string;
	alwaysShow: boolean;
	breadcrumb: boolean;
	showInTabs: boolean;
	affix: boolean;
}

