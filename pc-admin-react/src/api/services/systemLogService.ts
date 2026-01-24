import apiClient from "../apiClient";

import type { LogDetailResp, LogPageQuery, LogResp, PageResult } from "#/system";

export enum SystemLogApi {
	Page = "/system/log",
	Detail = "/system/log/:id",
	ExportLogin = "/system/log/export/login",
	ExportOperation = "/system/log/export/operation",
}

const pageLog = (query: LogPageQuery) => apiClient.get<PageResult<LogResp>>({ url: SystemLogApi.Page, params: query });
const getLogDetail = (id: number) => apiClient.get<LogDetailResp>({ url: SystemLogApi.Detail.replace(":id", String(id)) });
const exportLoginLog = (params?: Partial<LogPageQuery>) => apiClient.download({ url: SystemLogApi.ExportLogin, params });
const exportOperationLog = (params?: Partial<LogPageQuery>) => apiClient.download({ url: SystemLogApi.ExportOperation, params });

export default {
	pageLog,
	getLogDetail,
	exportLoginLog,
	exportOperationLog,
};
