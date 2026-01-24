import apiClient from "../apiClient";

import type { DeptResp, DeptSaveReq, IdsRequest } from "#/system";

export enum SystemDeptApi {
	Tree = "/system/dept/tree",
	Detail = "/system/dept/:id",
	Create = "/system/dept",
	Update = "/system/dept/:id",
	Delete = "/system/dept",
	Export = "/system/dept/export",
}

const listDeptTree = (params?: { description?: string; status?: number }) =>
	apiClient.get<DeptResp[]>({ url: SystemDeptApi.Tree, params });

const getDept = (id: number) => apiClient.get<DeptResp>({ url: SystemDeptApi.Detail.replace(":id", String(id)) });
const createDept = (data: DeptSaveReq) => apiClient.post<boolean>({ url: SystemDeptApi.Create, data });
const updateDept = (id: number, data: DeptSaveReq) =>
	apiClient.put<boolean>({ url: SystemDeptApi.Update.replace(":id", String(id)), data });
const deleteDept = (ids: number[]) => apiClient.delete<boolean>({ url: SystemDeptApi.Delete, data: { ids } satisfies IdsRequest });
const exportDept = (params?: Record<string, any>) => apiClient.download({ url: SystemDeptApi.Export, params });

export default {
	listDeptTree,
	getDept,
	createDept,
	updateDept,
	deleteDept,
	exportDept,
};
