import { GLOBAL_CONFIG } from "@/global-config";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import routeStore from "@/store/routeStore";
import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import type { ApiRes } from "#/api";

const serializeParams = (params: Record<string, unknown> | undefined) => {
	if (!params) return "";
	const searchParams = new URLSearchParams();

	for (const [key, raw] of Object.entries(params)) {
		if (raw === undefined || raw === null) continue;
		if (Array.isArray(raw)) {
			for (const item of raw) {
				if (item === undefined || item === null) continue;
				searchParams.append(key, String(item));
			}
			continue;
		}
		searchParams.append(key, String(raw));
	}

	return searchParams.toString();
};

const axiosInstance = axios.create({
	baseURL: GLOBAL_CONFIG.apiBaseUrl,
	timeout: 50000,
	headers: { "Content-Type": "application/json;charset=utf-8" },
	paramsSerializer: { serialize: (params) => serializeParams(params as Record<string, unknown>) },
});

axiosInstance.interceptors.request.use(
	(config) => {
		// FormData 请求不应强制 application/json，否则会导致上传/导入接口解析失败
		if (config.data instanceof FormData) {
			if (!config.headers) {
				config.headers = new AxiosHeaders();
			}
			if (config.headers instanceof AxiosHeaders) {
				config.headers.delete("Content-Type");
			} else {
				delete (config.headers as any)["Content-Type"];
			}
		}

		const token = userStore.getState().userToken.accessToken;
		if (token) {
			if (!config.headers) {
				config.headers = new AxiosHeaders();
			}
			if (config.headers instanceof AxiosHeaders) {
				config.headers.set("Authorization", `Bearer ${token}`);
			} else {
				(config.headers as any).Authorization = `Bearer ${token}`;
			}
		}
		return config;
	},
	(error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
	(res: AxiosResponse<any>) => {
		// 下载场景：返回文件 Blob；如果后端实际返回 JSON 错误，则解析并提示
		if (res.config.responseType === "blob") {
			const blob = res.data as Blob;
			const contentType = blob?.type || String(res.headers?.["content-type"] || "");
			if (contentType.startsWith("application/json")) {
				return blob.text().then((text) => {
					let parsed: Partial<ApiRes<unknown>> | null = null;
					try {
						parsed = JSON.parse(text) as Partial<ApiRes<unknown>>;
					} catch {
						parsed = null;
					}

					const err = new Error(parsed?.msg || t("sys.api.apiRequestFailed")) as Error & { __biz?: boolean; code?: string };
					err.__biz = true;
					err.code = parsed?.code;
					if (err.code === "401") {
						userStore.getState().actions.clearUserInfoAndToken();
						routeStore.getState().actions.clearRoutes();
					}
					return Promise.reject(err);
				});
			}
			return res;
		}

		const payload = res.data;
		if (!payload) {
			const err = new Error(t("sys.api.apiRequestFailed")) as Error & { __biz?: boolean };
			err.__biz = true;
			return Promise.reject(err);
		}
		if (payload.success) {
			return payload.data;
		}
		const err = new Error(payload.msg || t("sys.api.apiRequestFailed")) as Error & { __biz?: boolean; code?: string };
		err.__biz = true;
		err.code = payload.code;
		if (payload.code === "401") {
			userStore.getState().actions.clearUserInfoAndToken();
			routeStore.getState().actions.clearRoutes();
		}
		return Promise.reject(err);
	},
	(error: AxiosError<ApiRes<unknown>> & { __biz?: boolean; code?: string }) => {
		if (error.__biz) {
			const errMsg = error.message || t("sys.api.errorMessage");
			toast.error(errMsg, { position: "top-center" });
			return Promise.reject(error);
		}

		const { response, message } = error || {};
		const errMsg = response?.data?.msg || message || t("sys.api.errorMessage");
		toast.error(errMsg, { position: "top-center" });
		if (response?.status === 401 || response?.data?.code === "401") {
			userStore.getState().actions.clearUserInfoAndToken();
			routeStore.getState().actions.clearRoutes();
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
	patch<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "PATCH" });
	}
	delete<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "DELETE" });
	}
	download(config: AxiosRequestConfig): Promise<AxiosResponse<Blob>> {
		return axiosInstance.request<any, AxiosResponse<Blob>>({ ...config, method: "GET", responseType: "blob" });
	}
	request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return axiosInstance.request<any, T>(config);
	}
}

export default new APIClient();
