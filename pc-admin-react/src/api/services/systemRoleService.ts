import apiClient from "../apiClient";

import type {
	IdsRequest,
	PageResult,
	RoleDetailResp,
	RolePermissionUpdateReq,
	RoleQuery,
	RoleResp,
	RoleSaveReq,
	RoleUserPageQuery,
	RoleUserResp,
} from "#/system";

export enum SystemRoleApi {
	List = "/system/role/list",
	Detail = "/system/role/:id",
	Create = "/system/role",
	Update = "/system/role/:id",
	Delete = "/system/role",
	UpdatePermission = "/system/role/:id/permission",
	PageRoleUser = "/system/role/:id/user",
	AssignToUsers = "/system/role/:id/user",
	UnassignFromUsers = "/system/role/user",
	ListRoleUserIDs = "/system/role/:id/user/id",
}

const listRole = (query?: RoleQuery) => apiClient.get<RoleResp[]>({ url: SystemRoleApi.List, params: query });
const getRole = (id: number) => apiClient.get<RoleDetailResp>({ url: SystemRoleApi.Detail.replace(":id", String(id)) });
const createRole = (data: RoleSaveReq) => apiClient.post<{ id: number }>({ url: SystemRoleApi.Create, data });
const updateRole = (id: number, data: RoleSaveReq) =>
	apiClient.put<boolean>({ url: SystemRoleApi.Update.replace(":id", String(id)), data });
const deleteRole = (ids: number[]) => apiClient.delete<boolean>({ url: SystemRoleApi.Delete, data: { ids } satisfies IdsRequest });
const updateRolePermission = (id: number, data: RolePermissionUpdateReq) =>
	apiClient.put<boolean>({ url: SystemRoleApi.UpdatePermission.replace(":id", String(id)), data });
const pageRoleUser = (roleId: number, query: RoleUserPageQuery) =>
	apiClient.get<PageResult<RoleUserResp>>({ url: SystemRoleApi.PageRoleUser.replace(":id", String(roleId)), params: query });
const assignToUsers = (roleId: number, userIds: number[]) =>
	apiClient.post<boolean>({ url: SystemRoleApi.AssignToUsers.replace(":id", String(roleId)), data: userIds });
const unassignFromUsers = (userRoleIds: number[]) => apiClient.delete<boolean>({ url: SystemRoleApi.UnassignFromUsers, data: userRoleIds });
const listRoleUserIds = (roleId: number) =>
	apiClient.get<number[]>({ url: SystemRoleApi.ListRoleUserIDs.replace(":id", String(roleId)) });

export default {
	listRole,
	getRole,
	createRole,
	updateRole,
	deleteRole,
	updateRolePermission,
	pageRoleUser,
	assignToUsers,
	unassignFromUsers,
	listRoleUserIds,
};
