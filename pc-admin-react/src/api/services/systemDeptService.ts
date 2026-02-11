import apiClient from "../apiClient";

export type SysDeptNode = {
	id: number;
	name: string;
	parentId: number;
	sort: number;
	status: number;
	isSystem: boolean;
	description: string;
	children?: SysDeptNode[];
};

export type SysDeptSaveReq = {
	name: string;
	parentId: number;
	sort: number;
	status: number;
	description: string;
};

export const systemDeptService = {
	tree: (params?: { description?: string; status?: number }) =>
		apiClient.get<SysDeptNode[]>({
			url: "/system/dept/tree",
			params: {
				description: params?.description,
				status: params?.status,
			},
		}),
	get: (id: number) => apiClient.get<SysDeptNode>({ url: `/system/dept/${id}` }),
	create: (data: SysDeptSaveReq) => apiClient.post<boolean>({ url: "/system/dept", data }),
	update: (id: number, data: SysDeptSaveReq) => apiClient.put<boolean>({ url: `/system/dept/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/dept", data: { ids } }),
	exportCsv: (params?: { description?: string; status?: number }) =>
		apiClient.request<Blob>({
			url: "/system/dept/export",
			method: "GET",
			params: { description: params?.description, status: params?.status },
			responseType: "blob",
		}),
};
