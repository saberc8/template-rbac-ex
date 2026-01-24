import apiClient from "../apiClient";

import type { DictItemPageQuery, DictItemResp, DictItemSaveReq, IdsRequest, PageResult } from "#/system";

export enum SystemDictItemApi {
	Page = "/system/dict/item",
	Detail = "/system/dict/item/:id",
	Create = "/system/dict/item",
	Update = "/system/dict/item/:id",
	Delete = "/system/dict/item",
}

const listDictItemPage = (query: DictItemPageQuery) =>
	apiClient.get<PageResult<DictItemResp>>({ url: SystemDictItemApi.Page, params: query });

const getDictItem = (id: number) => apiClient.get<DictItemResp>({ url: SystemDictItemApi.Detail.replace(":id", String(id)) });

const createDictItem = (data: DictItemSaveReq) => apiClient.post<{ id: number }>({ url: SystemDictItemApi.Create, data });

const updateDictItem = (id: number, data: Omit<DictItemSaveReq, "dictId">) =>
	apiClient.put<boolean>({ url: SystemDictItemApi.Update.replace(":id", String(id)), data });

const deleteDictItem = (ids: number[]) =>
	apiClient.delete<boolean>({ url: SystemDictItemApi.Delete, data: { ids } satisfies IdsRequest });

export default {
	listDictItemPage,
	getDictItem,
	createDictItem,
	updateDictItem,
	deleteDictItem,
};

