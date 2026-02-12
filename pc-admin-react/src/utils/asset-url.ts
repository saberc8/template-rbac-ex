import { GLOBAL_CONFIG } from "@/global-config";

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

export const getBackendOrigin = () => {
	if (typeof window === "undefined") return "";
	const apiBaseUrl = String(GLOBAL_CONFIG.apiBaseUrl || "").trim();
	if (!apiBaseUrl) return window.location.origin;
	if (isHttpUrl(apiBaseUrl)) {
		try {
			return new URL(apiBaseUrl).origin;
		} catch {
			return window.location.origin;
		}
	}
	// "/api" 这类相对路径：默认与前端同源（开发环境可由 Vite proxy 接管）。
	return window.location.origin;
};

/**
 * 将后端返回的资源地址统一解析为可用于 <img src>/<link href> 的 URL。
 *
 * 约定：
 * - 后端返回优先为相对路径（如 `/file/...`）
 * - 前端渲染时再根据 `GLOBAL_CONFIG.apiBaseUrl` 推导资源所在的 origin（同源或独立 API 域名）
 */
export const resolveAssetUrl = (raw: string): string => {
	const v = String(raw || "").trim();
	if (!v) return "";
	if (v.startsWith("data:")) return v;
	if (isHttpUrl(v)) return v;
	if (v.startsWith("//")) return `${typeof window !== "undefined" ? window.location.protocol : "https:"}${v}`;
	if (typeof window === "undefined") return v;

	const origin = getBackendOrigin() || window.location.origin;
	if (v.startsWith("/")) return `${origin}${v}`;
	return `${origin}/${v}`;
};

