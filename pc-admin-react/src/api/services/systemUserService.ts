import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysUserRow = {
	id: number;
	username: string;
	nickname: string;
	email: string;
	avatar: string;
	status: number;
	deptName: string;
	roleNames: string[];

	// extended fields from backend
	gender?: number;
	phone?: string;
	description?: string;
	isSystem?: boolean;
	createTime?: string;
	updateTime?: string;
	roleIds?: number[];
};

export type ListUserQuery = {
	page: number;
	size: number;
	description?: string;
	status?: number;
	deptId?: number;
};

export type SysUserDetail = {
	id: number;
	username: string;
	nickname: string;
	avatar: string;
	gender: number;
	email: string;
	phone: string;
	description: string;
	status: number;
	isSystem: boolean;
	deptId: number;
	deptName: string;
	roleIds: number[];
	roleNames: string[];
	createTime: string;
	updateTime: string;
	createUserString?: string;
	updateUserString?: string;
	pwdResetTime?: string;
};

export type SysUserCreateReq = {
	username: string;
	nickname: string;
	password: string;
	gender: number;
	status: number;
	deptId: number;
	roleIds: number[];
	email?: string;
	phone?: string;
	avatar?: string;
	description?: string;
};

export type SysUserUpdateReq = Omit<SysUserCreateReq, "password">;

export type UserImportParseResp = {
	importKey: string;
	totalRows: number;
	validRows: number;
	duplicateUserRows: number;
	duplicateEmailRows: number;
	duplicatePhoneRows: number;
};

export type UserImportReq = {
	importKey: string;
	errorPolicy: number;
	duplicateUser: number;
	duplicateEmail: number;
	duplicatePhone: number;
	defaultStatus: number;
};

export type UserImportResult = {
	totalRows: number;
	insertRows: number;
	updateRows: number;
};

export const systemUserService = {
	page: (query: ListUserQuery) =>
		apiClient.get<PageResult<SysUserRow>>({
			url: "/system/user",
			params: {
				page: query.page,
				size: query.size,
				description: query.description,
				status: query.status,
				deptId: query.deptId,
			},
		}),
	get: (id: string) => apiClient.get<SysUserDetail>({ url: `/system/user/${id}` }),
	create: (data: SysUserCreateReq) => apiClient.post<{ id: number }>({ url: "/system/user", data }),
	update: (id: number, data: SysUserUpdateReq) => apiClient.put<boolean>({ url: `/system/user/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/user", data: { ids } }),
	resetPassword: (id: number, newPassword: string) => apiClient.request<boolean>({ url: `/system/user/${id}/password`, method: "PATCH", data: { newPassword } }),
	updateRole: (id: number, roleIds: number[]) => apiClient.request<boolean>({ url: `/system/user/${id}/role`, method: "PATCH", data: { roleIds } }),
	exportCsv: () => apiClient.request<Blob>({ url: "/system/user/export", method: "GET", responseType: "blob" }),
	downloadImportTemplate: () => apiClient.request<Blob>({ url: "/system/user/import/template", method: "GET", responseType: "blob" }),
	parseImport: (file: File) => {
		const formData = new FormData();
		formData.append("file", file);
		return apiClient.request<UserImportParseResp>({
			url: "/system/user/import/parse",
			method: "POST",
			data: formData,
			headers: { "Content-Type": "multipart/form-data" },
		});
	},
	importUsers: (data: UserImportReq) => apiClient.post<UserImportResult>({ url: "/system/user/import", data }),
};
