import apiClient from "../apiClient";

import type { IdsRequest, StorageResp, StorageSaveReq } from "#/system";

export enum SystemStorageApi {
	List = "/system/storage/list",
	Detail = "/system/storage/:id",
	Create = "/system/storage",
	Update = "/system/storage/:id",
	Delete = "/system/storage",
	UpdateStatus = "/system/storage/:id/status",
	SetDefault = "/system/storage/:id/default",
}

const listStorage = (params?: { description?: string; type?: number }) =>
	apiClient.get<StorageResp[]>({ url: SystemStorageApi.List, params });

const getStorage = (id: number) => apiClient.get<StorageResp>({ url: SystemStorageApi.Detail.replace(":id", String(id)) });

const createStorage = (data: StorageSaveReq) => apiClient.post<{ id: number }>({ url: SystemStorageApi.Create, data });

const updateStorage = (id: number, data: StorageSaveReq) =>
	apiClient.put<boolean>({ url: SystemStorageApi.Update.replace(":id", String(id)), data });

const deleteStorage = (ids: number[]) =>
	apiClient.delete<boolean>({ url: SystemStorageApi.Delete, data: { ids } satisfies IdsRequest });

const updateStorageStatus = (id: number, status: number) =>
	apiClient.put<boolean>({ url: SystemStorageApi.UpdateStatus.replace(":id", String(id)), data: { status } });

const setDefaultStorage = (id: number) =>
	apiClient.put<boolean>({ url: SystemStorageApi.SetDefault.replace(":id", String(id)) });

export default {
	listStorage,
	getStorage,
	createStorage,
	updateStorage,
	deleteStorage,
	updateStorageStatus,
	setDefaultStorage,
};

