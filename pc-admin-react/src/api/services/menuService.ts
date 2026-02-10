import apiClient from "../apiClient";

import type { MenuTree } from "#/entity";

export enum MenuApi {
	Menu = "/menu",
}

const getMenuTree = () => apiClient.get<MenuTree[]>({ url: MenuApi.Menu });

export default {
	getMenuTree,
};
