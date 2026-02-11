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

export type SysDictDetail = SysDict & {
	createUserString?: string;
	updateUserString?: string;
};

export type SysDictCreateReq = {
	name: string;
	code: string;
	description?: string;
};

export type SysDictUpdateReq = {
	name: string;
	description?: string;
};

export const systemDictService = {
	list: (description?: string) =>
		apiClient.get<SysDict[]>({
			url: "/system/dict/list",
			params: description ? { description } : undefined,
		}),

	get: (id: number) => apiClient.get<SysDictDetail>({ url: `/system/dict/${id}` }),
	create: (data: SysDictCreateReq) => apiClient.post<{ id: number }>({ url: "/system/dict", data }),
	update: (id: number, data: SysDictUpdateReq) => apiClient.put<boolean>({ url: `/system/dict/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/dict", data: { ids } }),

	clearCache: (code: string) => apiClient.delete<boolean>({ url: `/system/dict/cache/${encodeURIComponent(code)}` }),
};
