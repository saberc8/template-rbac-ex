import apiClient from "../apiClient";

export type LabelValue = {
	label: string;
	value: string;
};

export const siteOptionService = {
	listSiteOptions: () => apiClient.get<LabelValue[]>({ url: "/common/dict/option/site" }),
};

