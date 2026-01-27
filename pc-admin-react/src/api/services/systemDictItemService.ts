import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysDictItemRow = {
	id: number;
	label: string;
	value: string;
	color: string;
	sort: number;
	description: string;
	status: number;
	dictId: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type ListDictItemQuery = {
	dictId: number;
	page: number;
	size: number;
	description?: string;
	status?: number;
};

export const systemDictItemService = {
	page: (query: ListDictItemQuery) =>
		apiClient.get<PageResult<SysDictItemRow>>({
			url: "/system/dict/item",
			params: {
				dictId: query.dictId,
				page: query.page,
				size: query.size,
				description: query.description,
				status: query.status,
			},
		}),
};

