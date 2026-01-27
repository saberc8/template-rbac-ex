import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type OnlineUserRow = {
	id: number;
	token: string;
	username: string;
	nickname: string;
	clientType: string;
	clientId: string;
	ip: string;
	address: string;
	browser: string;
	os: string;
	loginTime: string;
	lastActiveTime: string;
};

export type OnlineUserQuery = {
	page: number;
	size: number;
	nickname?: string;
};

export const systemOnlineService = {
	page: (query: OnlineUserQuery) =>
		apiClient.get<PageResult<OnlineUserRow>>({
			url: "/monitor/online",
			params: {
				page: query.page,
				size: query.size,
				nickname: query.nickname,
			},
		}),
};

