import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysLogRow = {
	id: number;
	description: string;
	module: string;
	timeTaken: number;
	ip: string;
	address: string;
	browser: string;
	os: string;
	status: number;
	errorMsg: string;
	createUserString: string;
	createTime: string;
};

export type SysLogDetail = SysLogRow & {
	traceId: string;
	requestUrl: string;
	requestMethod: string;
	requestHeaders: string;
	requestBody: string;
	statusCode: number;
	responseHeaders: string;
	responseBody: string;
};

export type SysLogQuery = {
	page: number;
	size: number;
	description?: string;
	module?: string;
	ip?: string;
	createUserString?: string;
	createTime?: string[];
	status?: number;
};

export type SysLogExportQuery = Omit<SysLogQuery, "page" | "size">;

export const systemLogService = {
	page: (query: SysLogQuery) =>
		apiClient.get<PageResult<SysLogRow>>({
			url: "/system/log",
			params: {
				page: query.page,
				size: query.size,
				description: query.description,
				module: query.module,
				ip: query.ip,
				createUserString: query.createUserString,
				createTime: query.createTime,
				status: query.status,
			},
		}),
	get: (id: number) => apiClient.get<SysLogDetail>({ url: `/system/log/${id}` }),

	exportLoginCsv: (query: SysLogExportQuery) =>
		apiClient.request<Blob>({
			method: "GET",
			url: "/system/log/export/login",
			params: {
				description: query.description,
				module: query.module,
				ip: query.ip,
				createUserString: query.createUserString,
				createTime: query.createTime,
				status: query.status,
			},
			responseType: "blob",
		}),
	exportOperationCsv: (query: SysLogExportQuery) =>
		apiClient.request<Blob>({
			method: "GET",
			url: "/system/log/export/operation",
			params: {
				description: query.description,
				module: query.module,
				ip: query.ip,
				createUserString: query.createUserString,
				createTime: query.createTime,
				status: query.status,
			},
			responseType: "blob",
		}),
};
