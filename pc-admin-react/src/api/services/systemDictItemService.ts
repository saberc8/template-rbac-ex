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

export type SysDictItemDetail = SysDictItemRow;

export type SysDictItemSaveReq = {
	label: string;
	value: string;
	color?: string;
	sort: number;
	description?: string;
	status: number;
	dictId?: number;
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

	get: (id: number) => apiClient.get<SysDictItemDetail>({ url: `/system/dict/item/${id}` }),
	create: (data: SysDictItemSaveReq & { dictId: number }) => apiClient.post<{ id: number }>({ url: "/system/dict/item", data }),
	update: (id: number, data: SysDictItemSaveReq) => apiClient.put<boolean>({ url: `/system/dict/item/${id}`, data }),
	delete: (ids: number[]) => apiClient.delete<boolean>({ url: "/system/dict/item", data: { ids } }),
};
