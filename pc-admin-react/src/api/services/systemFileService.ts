import apiClient from "../apiClient";

import type { FileDirCalcSizeResp, FileDirCreateReq, FileItem, FilePageQuery, FileStatisticsResp, FileUpdateReq, FileUploadResp, IdsRequest, PageResult } from "#/system";

export enum SystemFileApi {
	Page = "/system/file",
	Upload = "/system/file/upload",
	CreateDir = "/system/file/dir",
	CalcDirSize = "/system/file/dir/:id/size",
	Statistics = "/system/file/statistics",
	Update = "/system/file/:id",
	Delete = "/system/file",
}

const listFilePage = (query: FilePageQuery) => apiClient.get<PageResult<FileItem>>({ url: SystemFileApi.Page, params: query });
const uploadFile = (formData: FormData) => apiClient.post<FileUploadResp>({ url: SystemFileApi.Upload, data: formData });
const createDir = (data: FileDirCreateReq) => apiClient.post<boolean>({ url: SystemFileApi.CreateDir, data });
const calcDirSize = (id: number) =>
	apiClient.get<FileDirCalcSizeResp>({ url: SystemFileApi.CalcDirSize.replace(":id", String(id)) });
const statistics = () => apiClient.get<FileStatisticsResp[]>({ url: SystemFileApi.Statistics });
const updateFile = (id: number, data: FileUpdateReq) => apiClient.put<boolean>({ url: SystemFileApi.Update.replace(":id", String(id)), data });
const deleteFile = (ids: number[]) => apiClient.delete<boolean>({ url: SystemFileApi.Delete, data: { ids } satisfies IdsRequest });

export default {
	listFilePage,
	uploadFile,
	createDir,
	calcDirSize,
	statistics,
	updateFile,
	deleteFile,
};
