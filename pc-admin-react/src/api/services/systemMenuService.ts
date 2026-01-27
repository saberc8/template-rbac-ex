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

export const systemMenuService = {
	tree: () => apiClient.get<SysMenuNode[]>({ url: "/system/menu/tree" }),
};

