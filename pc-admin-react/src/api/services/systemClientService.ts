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

export type SysClientDetail = SysClientRow;

export type SysClientSaveReq = {
	clientType: string;
	authType: string[];
	activeTimeout: number;
	timeout: number;
	status: number;
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

	get: (id: number) => apiClient.get<SysClientDetail>({ url: `/system/client/${id}` }),
	create: (data: SysClientSaveReq) => apiClient.post<{ id: number }>({ url: "/system/client", data }),
	update: (id: number, data: SysClientSaveReq) => apiClient.put<boolean>({ url: `/system/client/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/client", data: { ids } }),
};
