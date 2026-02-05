// 文件管理-预览弹窗：图片/音视频/pdf 预览，其余兜底打开 URL。

import type { SysFileRow } from "@/api/services/systemFileService";
import { guessPreviewKind } from "@/constants/file";
import { Modal } from "antd";
import { useMemo } from "react";

export default function FilePreviewModal({
	open,
	item,
	onOpenChange,
}: {
	open: boolean;
	item: SysFileRow | null;
	onOpenChange: (open: boolean) => void;
}) {
	const url = (item?.url || "").trim();
	const kind = useMemo(() => guessPreviewKind(item?.extension, item?.contentType), [item?.extension, item?.contentType]);

	return (
		<Modal
			open={open}
			title={`预览：${item?.originalName || ""}`}
			okText="关闭"
			cancelButtonProps={{ style: { display: "none" } }}
			onOk={() => onOpenChange(false)}
			onCancel={() => onOpenChange(false)}
			width={900}
		>
			{!url ? (
				<div className="text-sm text-muted-foreground">URL 为空，无法预览。</div>
			) : kind === "image" ? (
				<div className="w-full flex items-center justify-center">
					<img src={url} alt={item?.originalName || ""} className="max-h-[70vh] max-w-full object-contain" />
				</div>
			) : kind === "video" ? (
				<video src={url} controls className="w-full max-h-[70vh]" />
			) : kind === "audio" ? (
				<audio src={url} controls className="w-full" />
			) : kind === "pdf" ? (
				<iframe title="pdf-preview" src={url} className="w-full h-[70vh] border-0" />
			) : (
				<div className="space-y-3">
					<div className="text-sm text-muted-foreground">当前类型暂不支持内嵌预览，可在新标签页打开。</div>
					<a href={url} target="_blank" rel="noreferrer">
						打开链接
					</a>
				</div>
			)}
		</Modal>
	);
}

