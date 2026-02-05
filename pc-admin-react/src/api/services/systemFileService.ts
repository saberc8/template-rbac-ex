// 文件管理相关 API：对齐 backend-go/pc-admin-vue3（列表/上传/统计/目录/重命名/删除）。
import apiClient from "../apiClient";

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type SysFileRow = {
	id: number;
	name?: string;
	originalName: string;
	size: number | null;
	type: number;
	url: string;
	parentPath: string;
	path?: string;
	sha256?: string;
	contentType?: string;
	metadata?: string;
	thumbnailSize?: number | null;
	thumbnailName?: string;
	thumbnailMetadata?: string;
	thumbnailUrl?: string;
	extension?: string;
	storageId?: number;
	storageName: string;
	createUserString?: string;
	createTime?: string;
	updateUserString?: string;
	updateTime: string;
};

export type ListFileQuery = {
	page: number;
	size: number;
	originalName?: string;
	type?: number;
	parentPath?: string;
};

export type FileUploadResp = {
	id: string;
	url: string;
	thUrl: string;
	metadata: Record<string, unknown>;
};

export type FileDirCalcSizeResp = {
	size: number;
};

export type FileStatisticsItem = {
	type: number;
	size: number;
	number: number;
	data?: FileStatisticsItem[];
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
	upload: (file: File, parentPath: string = "/", opts?: { signal?: AbortSignal; onProgress?: (percent: number) => void }) => {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("parentPath", parentPath || "/");
		return apiClient.request<FileUploadResp>({
			url: "/system/file/upload",
			method: "POST",
			data: formData,
			signal: opts?.signal,
			onUploadProgress: (e) => {
				if (!opts?.onProgress) return;
				const total = e.total || 0;
				if (!total) return;
				const percent = Math.min(100, Math.max(0, Math.round((e.loaded / total) * 100)));
				opts.onProgress(percent);
			},
			headers: { "Content-Type": "multipart/form-data" },
		});
	},
	statistics: () => apiClient.get<FileStatisticsItem>({ url: "/system/file/statistics" }),
	createDir: (parentPath: string, originalName: string) =>
		apiClient.post<boolean>({
			url: "/system/file/dir",
			data: { parentPath, originalName },
		}),
	calcDirSize: (id: number) => apiClient.get<FileDirCalcSizeResp>({ url: `/system/file/dir/${id}/size` }),
	rename: (id: number, originalName: string) =>
		apiClient.put<boolean>({
			url: `/system/file/${id}`,
			data: { originalName },
		}),
	delete: (ids: number[]) =>
		apiClient.delete<boolean>({
			url: "/system/file",
			data: { ids },
		}),
};
