import apiClient from "../apiClient";

export type SysRole = {
	id: number;
	name: string;
	code: string;
	sort: number;
	description: string;
	dataScope: number;
	isSystem: boolean;
	createUserString?: string;
	createTime?: string;
	updateUserString?: string;
	updateTime?: string;
	disabled: boolean;
};

export type SysRoleDetail = SysRole & {
	menuIds: Array<string | number>;
	deptIds: number[];
	menuCheckStrictly: boolean;
	deptCheckStrictly: boolean;
};

export type SysRoleSaveReq = {
	name: string;
	code: string;
	sort: number;
	description: string;
	dataScope: number;
	deptIds: number[];
	deptCheckStrictly: boolean;
};

export type RolePermissionSaveReq = {
	menuIds: Array<string | number>;
	menuCheckStrictly: boolean;
};

export type RoleUserRow = {
	id: number; // sys_user_role.id
	roleId: number;
	userId: number;
	username: string;
	nickname: string;
	gender: number;
	status: number;
	isSystem: boolean;
	description: string;
	deptId: number;
	deptName: string;
	roleIds: number[];
	roleNames: string[];
	disabled: boolean;
};

export type PageResult<T> = {
	list: T[];
	total: number;
};

export const systemRoleService = {
	list: (description?: string) =>
		apiClient.get<SysRole[]>({
			url: "/system/role/list",
			params: description ? { description } : undefined,
		}),
	get: (id: number) => apiClient.get<SysRoleDetail>({ url: `/system/role/${id}` }),
	create: (data: SysRoleSaveReq) => apiClient.post<{ id: number }>({ url: "/system/role", data }),
	update: (id: number, data: SysRoleSaveReq) => apiClient.put<boolean>({ url: `/system/role/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/role", data: { ids } }),

	updatePermission: (id: number, data: RolePermissionSaveReq) => apiClient.put<boolean>({ url: `/system/role/${id}/permission`, data }),

	pageRoleUsers: (id: number, params: { page: number; size: number; description?: string }) =>
		apiClient.get<PageResult<RoleUserRow>>({
			url: `/system/role/${id}/user`,
			params: { page: params.page, size: params.size, description: params.description },
		}),
	assignUsers: (id: number, userIds: number[]) => apiClient.post<boolean>({ url: `/system/role/${id}/user`, data: userIds }),
	unassignUsers: (userRoleIds: number[]) => apiClient.delete<boolean>({ url: "/system/role/user", data: userRoleIds }),
	listRoleUserIds: (id: number) => apiClient.get<number[]>({ url: `/system/role/${id}/user/id` }),
};
