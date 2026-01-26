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
};

export type ListUserQuery = {
	page: number;
	size: number;
	description?: string;
	status?: number;
	deptId?: number;
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
	get: (id: string) => apiClient.get<any>({ url: `/system/user/${id}` }),
};
