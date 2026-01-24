import apiClient from "../apiClient";

import type { OnlineUserPageQuery, OnlineUserResp, PageResult } from "#/system";

export enum MonitorOnlineApi {
	Page = "/monitor/online",
	Kickout = "/monitor/online/:token",
}

const pageOnlineUser = (query: OnlineUserPageQuery) =>
	apiClient.get<PageResult<OnlineUserResp>>({ url: MonitorOnlineApi.Page, params: query });

const kickout = (token: string) => apiClient.delete<boolean>({ url: MonitorOnlineApi.Kickout.replace(":token", token) });

export default {
	pageOnlineUser,
	kickout,
};

