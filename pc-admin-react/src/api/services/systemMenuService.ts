import apiClient from "../apiClient";

import type { IdsRequest, MenuResp, MenuSaveReq } from "#/system";

export enum SystemMenuApi {
	Tree = "/system/menu/tree",
	Detail = "/system/menu/:id",
	Create = "/system/menu",
	Update = "/system/menu/:id",
	Delete = "/system/menu",
	ClearCache = "/system/menu/cache",
}

const listMenuTree = () => apiClient.get<MenuResp[]>({ url: SystemMenuApi.Tree });
const getMenu = (id: number) => apiClient.get<MenuResp>({ url: SystemMenuApi.Detail.replace(":id", String(id)) });
const createMenu = (data: MenuSaveReq) => apiClient.post<{ id: number }>({ url: SystemMenuApi.Create, data });
const updateMenu = (id: number, data: MenuSaveReq) => apiClient.put<boolean>({ url: SystemMenuApi.Update.replace(":id", String(id)), data });
const deleteMenu = (ids: number[]) => apiClient.delete<boolean>({ url: SystemMenuApi.Delete, data: { ids } satisfies IdsRequest });
const clearMenuCache = () => apiClient.delete<boolean>({ url: SystemMenuApi.ClearCache });

export default {
	listMenuTree,
	getMenu,
	createMenu,
	updateMenu,
	deleteMenu,
	clearMenuCache,
};
