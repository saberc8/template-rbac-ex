import apiClient from "../apiClient";

export type SysOption = {
	id: number;
	name: string;
	code: string;
	value: string;
	description: string;
};

export type SysOptionUpdateReq = {
	id: number;
	code: string;
	value: any;
};

export const systemOptionService = {
	list: (params?: { category?: string; code?: string[] }) =>
		apiClient.get<SysOption[]>({
			url: "/system/option",
			params: {
				category: params?.category,
				code: params?.code,
			},
		}),

	update: (items: SysOptionUpdateReq[]) => apiClient.put<boolean>({ url: "/system/option", data: items }),
	resetValue: (params: { category?: string; code?: string[] }) =>
		apiClient.request<boolean>({
			method: "PATCH",
			url: "/system/option/value",
			data: {
				category: params.category,
				code: params.code,
			},
		}),
};
