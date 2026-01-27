import apiClient from "../apiClient";

export type SysRole = {
	id: number;
	name: string;
	code: string;
	sort: number;
	description: string;
	dataScope: number;
	isSystem: boolean;
	disabled: boolean;
};

export const systemRoleService = {
	list: (description?: string) =>
		apiClient.get<SysRole[]>({
			url: "/system/role/list",
			params: description ? { description } : undefined,
		}),
};

