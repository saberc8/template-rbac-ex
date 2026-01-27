import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysFileRow = {
	id: number;
	originalName: string;
	size: number | null;
	type: number;
	parentPath: string;
	url: string;
	storageName: string;
	updateTime: string;
};

export type ListFileQuery = {
	page: number;
	size: number;
	originalName?: string;
	type?: number;
	parentPath?: string;
};

export const systemFileService = {
	page: (query: ListFileQuery) =>
		apiClient.get<PageResult<SysFileRow>>({
			url: "/system/file",
			params: {
				page: query.page,
				size: query.size,
				originalName: query.originalName,
				type: query.type,
				parentPath: query.parentPath,
			},
		}),
};

