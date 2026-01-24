import apiClient from "../apiClient";

import type { ClientQuery, ClientResp, ClientSaveReq, IdsRequest, PageResult } from "#/system";

export enum SystemClientApi {
	Page = "/system/client",
	Detail = "/system/client/:id",
	Create = "/system/client",
	Update = "/system/client/:id",
	Delete = "/system/client",
}

const listClientPage = (query: ClientQuery) => apiClient.get<PageResult<ClientResp>>({ url: SystemClientApi.Page, params: query });

const getClient = (id: number) => apiClient.get<ClientResp>({ url: SystemClientApi.Detail.replace(":id", String(id)) });

const createClient = (data: ClientSaveReq) => apiClient.post<{ id: number }>({ url: SystemClientApi.Create, data });

const updateClient = (id: number, data: ClientSaveReq) =>
	apiClient.put<boolean>({ url: SystemClientApi.Update.replace(":id", String(id)), data });

const deleteClient = (ids: number[]) =>
	apiClient.delete<boolean>({ url: SystemClientApi.Delete, data: { ids } satisfies IdsRequest });

export default {
	listClientPage,
	getClient,
	createClient,
	updateClient,
	deleteClient,
};

