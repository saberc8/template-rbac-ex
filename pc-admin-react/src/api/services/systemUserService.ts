import apiClient from "../apiClient";

import type {
	IdsRequest,
	PageResult,
	SystemUserCreateReq,
	SystemUserPageQuery,
	SystemUserResp,
	SystemUserUpdateReq,
	UserImportParseResp,
	UserImportResultResp,
	UserPasswordResetReq,
	UserRoleUpdateReq,
} from "#/system";

export enum SystemUserApi {
	Page = "/system/user",
	Detail = "/system/user/:id",
	Create = "/system/user",
	Update = "/system/user/:id",
	Delete = "/system/user",
	ResetPassword = "/system/user/:id/password",
	UpdateRole = "/system/user/:id/role",
	Export = "/system/user/export",
	ImportTemplate = "/system/user/import/template",
	ImportParse = "/system/user/import/parse",
	Import = "/system/user/import",
}

const listUserPage = (query: SystemUserPageQuery) =>
	apiClient.get<PageResult<SystemUserResp>>({ url: SystemUserApi.Page, params: query });

const getUserDetail = (id: number) =>
	apiClient.get<SystemUserResp>({ url: SystemUserApi.Detail.replace(":id", String(id)) });

const createUser = (data: SystemUserCreateReq) => apiClient.post<{ id: number }>({ url: SystemUserApi.Create, data });

const updateUser = (id: number, data: SystemUserUpdateReq) =>
	apiClient.put<boolean>({ url: SystemUserApi.Update.replace(":id", String(id)), data });

const deleteUser = (ids: number[]) => apiClient.delete<boolean>({ url: SystemUserApi.Delete, data: { ids } satisfies IdsRequest });

const resetPassword = (id: number, data: UserPasswordResetReq) =>
	apiClient.patch<boolean>({ url: SystemUserApi.ResetPassword.replace(":id", String(id)), data });

const updateUserRole = (id: number, data: UserRoleUpdateReq) =>
	apiClient.patch<boolean>({ url: SystemUserApi.UpdateRole.replace(":id", String(id)), data });

const exportUser = (params?: Record<string, any>) => apiClient.download({ url: SystemUserApi.Export, params });
const downloadImportTemplate = () => apiClient.download({ url: SystemUserApi.ImportTemplate });

const parseImportUser = (file: File) => {
	const data = new FormData();
	data.append("file", file);
	return apiClient.post<UserImportParseResp>({ url: SystemUserApi.ImportParse, data });
};

const importUser = (data: any) => apiClient.post<UserImportResultResp>({ url: SystemUserApi.Import, data });

export default {
	listUserPage,
	getUserDetail,
	createUser,
	updateUser,
	deleteUser,
	resetPassword,
	updateUserRole,
	exportUser,
	downloadImportTemplate,
	parseImportUser,
	importUser,
};
