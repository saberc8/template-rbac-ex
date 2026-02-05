// 文件管理相关常量：类型、图标与扩展名分类（对齐 pc-admin-vue3）。

export type FileTypeListItem = {
	name: string;
	value: number;
	icon: string;
};

/** 文件分类（与后端 detect_file_type 对齐：0=目录，1=其他，2=图片，3=文档，4=视频，5=音频） */
export const FileTypeList: FileTypeListItem[] = [
	{ name: "全部", value: 0, icon: "solar:apps-bold-duotone" },
	{ name: "图片", value: 2, icon: "solar:gallery-bold-duotone" },
	{ name: "文档", value: 3, icon: "solar:document-text-bold-duotone" },
	{ name: "视频", value: 4, icon: "solar:video-frame-bold-duotone" },
	{ name: "音频", value: 5, icon: "solar:music-notes-bold-duotone" },
	{ name: "其他", value: 1, icon: "solar:file-bold-duotone" },
];

export const ImageTypes = ["jpg", "png", "gif", "jpeg", "webp", "bmp"];
export const VideoTypes = ["mp4", "webm", "mov", "m4v"];
export const AudioTypes = ["mp3", "wav", "ogg", "m4a", "aac"];
export const PdfTypes = ["pdf"];
export const OfficeTypes = ["ppt", "pptx", "doc", "docx", "xls", "xlsx", "pdf", "txt"];

export const fileTypeName = (type: number) => FileTypeList.find((x) => x.value === type)?.name || String(type);

export const normalizeParentPath = (p: string) => {
	const trimmed = (p || "/").trim();
	if (!trimmed) return "/";
	const ensured = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	if (ensured.length > 1) return ensured.replace(/\/+$/g, "");
	return "/";
};

export const joinParentPath = (parentPath: string, name: string) => {
	const parent = normalizeParentPath(parentPath || "/");
	const seg = String(name || "").trim().replace(/^\/+|\/+$/g, "");
	if (!seg) return parent;
	return parent === "/" ? `/${seg}` : `${parent}/${seg}`;
};

export const buildBreadcrumbList = (parentPath: string) => {
	const path = normalizeParentPath(parentPath || "/");
	const parts = path.split("/").filter(Boolean);
	return parts.map((part, index) => ({
		name: part,
		path: `/${parts.slice(0, index + 1).join("/")}`,
	}));
};

export const guessPreviewKind = (extension?: string, contentType?: string) => {
	const ext = (extension || "").toLowerCase();
	const ct = (contentType || "").toLowerCase();

	if (ImageTypes.includes(ext) || ct.startsWith("image/")) return "image";
	if (VideoTypes.includes(ext) || ct.startsWith("video/")) return "video";
	if (AudioTypes.includes(ext) || ct.startsWith("audio/")) return "audio";
	if (PdfTypes.includes(ext) || ct === "application/pdf") return "pdf";
	return "other";
};

