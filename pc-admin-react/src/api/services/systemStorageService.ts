import apiClient from "../apiClient";

export type SysStorageRow = {
	id: number;
	name: string;
	code: string;
	type: number;
	accessKey: string;
	secretKey: string;
	endpoint: string;
	region: string;
	bucketName: string;
	domain: string;
	description: string;
	isDefault: boolean;
	sort: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type SysStorageSaveReq = {
	name: string;
	code: string;
	type: number;
	accessKey: string;
	secretKey?: string;
	endpoint: string;
	region: string;
	bucketName: string;
	domain: string;
	description: string;
	isDefault?: boolean;
	sort: number;
	status: number;
};

export const systemStorageService = {
	list: (params?: { description?: string; type?: number }) =>
		apiClient.get<SysStorageRow[]>({
			url: "/system/storage/list",
			params: {
				description: params?.description,
				type: params?.type,
			},
		}),
	get: (id: number) => apiClient.get<SysStorageRow>({ url: `/system/storage/${id}` }),
	create: (data: SysStorageSaveReq) => apiClient.post<{ id: number }>({ url: "/system/storage", data }),
	update: (id: number, data: SysStorageSaveReq) => apiClient.put<boolean>({ url: `/system/storage/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/storage", data: { ids } }),
	updateStatus: (id: number, status: number) => apiClient.put<boolean>({ url: `/system/storage/${id}/status`, data: { status } }),
	setDefault: (id: number) => apiClient.put<boolean>({ url: `/system/storage/${id}/default` }),
};
