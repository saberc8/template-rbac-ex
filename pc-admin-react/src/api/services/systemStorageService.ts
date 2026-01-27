import apiClient from "../apiClient";

export type SysStorageRow = {
	id: number;
	name: string;
	code: string;
	type: number;
	accessKey: string;
	secretKey: string;
	endpoint: string;
	region: string;
	bucketName: string;
	domain: string;
	description: string;
	isDefault: boolean;
	sort: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export const systemStorageService = {
	list: (params?: { description?: string; type?: number }) =>
		apiClient.get<SysStorageRow[]>({
			url: "/system/storage/list",
			params: {
				description: params?.description,
				type: params?.type,
			},
		}),
};

