import apiClient from "../apiClient";
import { GLOBAL_CONFIG } from "@/global-config";

export type SysMenuNode = {
	id: string | number;
	title: string;
	parentId: string | number;
	type: number;
	path: string;
	name: string;
	component: string;
	redirect: string;
	icon: string;
	isExternal: boolean;
	isCache: boolean;
	isHidden: boolean;
	permission: string;
	sort: number;
	status: number;
	createUserString?: string;
	createTime?: string;
	updateUserString?: string;
	updateTime?: string;
	children?: SysMenuNode[];
};

export type SysMenuSaveReq = {
	type: number;
	icon: string;
	title: string;
	sort: number;
	permission: string;
	path: string;
	name: string;
	component: string;
	redirect: string;
	isExternal: boolean;
	isCache: boolean;
	isHidden: boolean;
	parentId: string | number;
	status: number;
};

export const systemMenuService = {
	tree: () =>
		apiClient.get<SysMenuNode[]>({
			url: "/system/menu/tree",
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
	get: (id: string | number) =>
		apiClient.get<SysMenuNode>({
			url: `/system/menu/${id}`,
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
	create: (data: SysMenuSaveReq) =>
		apiClient.post<{ id: number }>({
			url: "/system/menu",
			data,
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
	update: (id: string | number, data: SysMenuSaveReq) =>
		apiClient.put<boolean>({
			url: `/system/menu/${id}`,
			data,
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
	delete: (ids: Array<string | number>) =>
		apiClient.delete<boolean>({
			url: "/system/menu",
			data: { ids },
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
	clearCache: () =>
		apiClient.delete<boolean>({
			url: "/system/menu/cache",
			headers: { "X-Admin-Frontend": GLOBAL_CONFIG.adminFrontendType },
		}),
};
