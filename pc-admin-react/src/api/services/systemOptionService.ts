import apiClient from "../apiClient";

import type { OptionResetReq, OptionResp, OptionUpdateReq } from "#/system";

export enum SystemOptionApi {
	List = "/system/option",
	Update = "/system/option",
	ResetValue = "/system/option/value",
}

const listOption = (params?: { code?: string[]; category?: string }) =>
	apiClient.get<OptionResp[]>({ url: SystemOptionApi.List, params });

const updateOption = (data: OptionUpdateReq[]) => apiClient.put<boolean>({ url: SystemOptionApi.Update, data });
const resetOptionValue = (data: OptionResetReq) => apiClient.patch<boolean>({ url: SystemOptionApi.ResetValue, data });

export default {
	listOption,
	updateOption,
	resetOptionValue,
};
