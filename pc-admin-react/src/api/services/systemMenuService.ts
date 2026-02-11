import apiClient from "../apiClient";

export type SysMenuNode = {
	id: number;
	title: string;
	parentId: number;
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
	parentId: number;
	status: number;
};

export const systemMenuService = {
	tree: () => apiClient.get<SysMenuNode[]>({ url: "/system/menu/tree" }),
	get: (id: number) => apiClient.get<SysMenuNode>({ url: `/system/menu/${id}` }),
	create: (data: SysMenuSaveReq) => apiClient.post<{ id: number }>({ url: "/system/menu", data }),
	update: (id: number, data: SysMenuSaveReq) => apiClient.put<boolean>({ url: `/system/menu/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/menu", data: { ids } }),
	clearCache: () => apiClient.delete<boolean>({ url: "/system/menu/cache" }),
};
