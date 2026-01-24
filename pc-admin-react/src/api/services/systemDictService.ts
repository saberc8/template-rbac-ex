import apiClient from "../apiClient";

import type { DictResp, DictSaveReq, IdsRequest } from "#/system";

export enum SystemDictApi {
	List = "/system/dict/list",
	Detail = "/system/dict/:id",
	Create = "/system/dict",
	Update = "/system/dict/:id",
	Delete = "/system/dict",
	ClearCache = "/system/dict/cache/:code",
}

const listDict = (params?: { description?: string }) => apiClient.get<DictResp[]>({ url: SystemDictApi.List, params });
const getDict = (id: number) => apiClient.get<DictResp>({ url: SystemDictApi.Detail.replace(":id", String(id)) });
const createDict = (data: DictSaveReq) => apiClient.post<{ id: number }>({ url: SystemDictApi.Create, data });
const updateDict = (id: number, data: DictSaveReq) =>
	apiClient.put<boolean>({ url: SystemDictApi.Update.replace(":id", String(id)), data });
const deleteDict = (ids: number[]) => apiClient.delete<boolean>({ url: SystemDictApi.Delete, data: { ids } satisfies IdsRequest });
const clearDictCache = (code: string) =>
	apiClient.delete<boolean>({ url: SystemDictApi.ClearCache.replace(":code", encodeURIComponent(code)) });

export default {
	listDict,
	getDict,
	createDict,
	updateDict,
	deleteDict,
	clearDictCache,
};
