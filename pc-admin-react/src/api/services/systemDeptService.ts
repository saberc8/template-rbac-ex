import apiClient from "../apiClient";

export type SysDeptNode = {
	id: number;
	name: string;
	parentId: number;
	sort: number;
	status: number;
	isSystem: boolean;
	description: string;
	children?: SysDeptNode[];
};

export const systemDeptService = {
	tree: (params?: { description?: string; status?: number }) =>
		apiClient.get<SysDeptNode[]>({
			url: "/system/dept/tree",
			params: {
				description: params?.description,
				status: params?.status,
			},
		}),
};

