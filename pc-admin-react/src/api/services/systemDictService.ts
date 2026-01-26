import apiClient from "../apiClient";

export type SysDict = {
	id: number;
	name: string;
	code: string;
	description: string;
	isSystem: boolean;
	createTime?: string;
	updateTime?: string;
};

export const systemDictService = {
	list: (description?: string) =>
		apiClient.get<SysDict[]>({
			url: "/system/dict/list",
			params: description ? { description } : undefined,
		}),
};

