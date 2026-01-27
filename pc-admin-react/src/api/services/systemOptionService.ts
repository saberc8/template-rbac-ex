import apiClient from "../apiClient";

export type SysOption = {
	id: number;
	name: string;
	code: string;
	value: string;
	description: string;
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
};

