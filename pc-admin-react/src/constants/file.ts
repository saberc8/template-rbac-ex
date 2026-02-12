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

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "other";

// 仅将“浏览器可稳定内嵌预览”的图片视为 image，避免 psd 等被误判为可预览图片。
const BrowserImageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "ico"];
const BrowserImageContentTypes = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/bmp",
	"image/svg+xml",
	"image/avif",
	"image/x-icon",
];

const TextExtensions = ["txt", "md", "json", "yml", "yaml", "xml", "csv", "log", "ini", "conf"];
const TextContentTypes = [
	"application/json",
	"application/xml",
	"application/yaml",
	"application/x-yaml",
	"application/x-www-form-urlencoded",
];

const normalizeExtension = (extension?: string) => String(extension || "").trim().replace(/^\./, "").toLowerCase();
const normalizeContentType = (contentType?: string) => String(contentType || "").trim().toLowerCase();

export const guessPreviewKind = (extension?: string, contentType?: string): PreviewKind => {
	const ext = normalizeExtension(extension);
	const ct = normalizeContentType(contentType);

	if (BrowserImageExtensions.includes(ext) || BrowserImageContentTypes.includes(ct)) return "image";
	if (VideoTypes.includes(ext) || ct.startsWith("video/")) return "video";
	if (AudioTypes.includes(ext) || ct.startsWith("audio/")) return "audio";
	if (PdfTypes.includes(ext) || ct === "application/pdf") return "pdf";
	if (TextExtensions.includes(ext) || ct.startsWith("text/") || TextContentTypes.includes(ct)) return "text";
	return "other";
};
