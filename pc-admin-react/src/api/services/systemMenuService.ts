import apiClient from "../apiClient";

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
	tree: () => apiClient.get<SysMenuNode[]>({ url: "/system/menu/tree" }),
	get: (id: string | number) => apiClient.get<SysMenuNode>({ url: `/system/menu/${id}` }),
	create: (data: SysMenuSaveReq) => apiClient.post<{ id: number }>({ url: "/system/menu", data }),
	update: (id: string | number, data: SysMenuSaveReq) => apiClient.put<boolean>({ url: `/system/menu/${id}`, data }),
	delete: (ids: Array<string | number>) => apiClient.delete<boolean>({ url: "/system/menu", data: { ids } }),
	clearCache: () => apiClient.delete<boolean>({ url: "/system/menu/cache" }),
};
