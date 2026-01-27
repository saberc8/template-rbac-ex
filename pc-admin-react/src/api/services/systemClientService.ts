import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysClientRow = {
	id: number;
	clientId: string;
	clientType: string;
	authType: string[];
	activeTimeout: number;
	timeout: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type ListClientQuery = {
	page: number;
	size: number;
	clientType?: string;
	authType?: string[];
	status?: number;
};

export const systemClientService = {
	page: (query: ListClientQuery) =>
		apiClient.get<PageResult<SysClientRow>>({
			url: "/system/client",
			params: {
				page: query.page,
				size: query.size,
				clientType: query.clientType,
				authType: query.authType,
				status: query.status,
			},
		}),
};

