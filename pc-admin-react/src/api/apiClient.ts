import { GLOBAL_CONFIG } from "@/global-config";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import type { Result } from "#/api";
import { ResultStatus } from "#/enum";

const axiosInstance = axios.create({
	baseURL: GLOBAL_CONFIG.apiBaseUrl,
	timeout: 50000,
	headers: { "Content-Type": "application/json;charset=utf-8" },
});

type ApiResponse<T = unknown> = {
	success: boolean;
	code: string;
	msg: string;
	data: T;
	timestamp?: string;
};

const isApiResponse = (v: any): v is ApiResponse => {
	return v && typeof v === "object" && typeof v.success === "boolean" && typeof v.code === "string" && "data" in v;
};

const isResult = (v: any): v is Result => {
	return v && typeof v === "object" && typeof v.status === "number" && "data" in v;
};

axiosInstance.interceptors.request.use(
	(config) => {
		const token = userStore.getState().userToken.accessToken;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
	(res: AxiosResponse<any>) => {
		if (res.data == null) throw new Error(t("sys.api.apiRequestFailed"));

		// 兼容两类后端响应：
		// 1) APIResponse<T>（vue3/go 对齐）：{success, code, msg, data}
		// 2) Result<T>（slash-admin）：{status, message, data}
		if (isApiResponse(res.data)) {
			const { success, data, msg, code } = res.data;
			if (success) return data;
			if (code === "401") {
				userStore.getState().actions.clearUserInfoAndToken();
			}
			throw new Error(msg || t("sys.api.apiRequestFailed"));
		}

		if (isResult(res.data)) {
			const { status, data, message } = res.data;
			if (status === ResultStatus.SUCCESS) return data;
			throw new Error(message || t("sys.api.apiRequestFailed"));
		}

		return res.data;
	},
	(error: AxiosError<Result>) => {
		const { response, message } = error || {};
		const errMsg = (response?.data as any)?.message || (response?.data as any)?.msg || message || t("sys.api.errorMessage");
		toast.error(errMsg, { position: "top-center" });
		if (response?.status === 401) {
			userStore.getState().actions.clearUserInfoAndToken();
		}
		return Promise.reject(error);
	},
);

class APIClient {
	get<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "GET" });
	}
	post<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "POST" });
	}
	put<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "PUT" });
	}
	delete<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "DELETE" });
	}
	request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return axiosInstance.request<any, T>(config);
	}
}

export default new APIClient();
