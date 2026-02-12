// 文件管理-预览弹窗：图片/音视频/pdf 预览，其余兜底打开 URL。

import type { SysFileRow } from "@/api/services/systemFileService";
import { guessPreviewKind } from "@/constants/file";
import { Modal } from "antd";
import { useEffect, useMemo, useState } from "react";

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

	const [textPreview, setTextPreview] = useState<{
		loading: boolean;
		text: string;
		truncated: boolean;
		error?: string;
	}>({ loading: false, text: "", truncated: false });

	useEffect(() => {
		if (!open || !url || kind !== "text") {
			setTextPreview({ loading: false, text: "", truncated: false });
			return;
		}

		const controller = new AbortController();
		const limitBytes = 200_000;

		setTextPreview({ loading: true, text: "", truncated: false });

		(async () => {
			try {
				const res = await fetch(url, { signal: controller.signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				let text = "";
				let truncated = false;

				if (res.body) {
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let total = 0;

					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						if (!value?.length) continue;

						if (total + value.length > limitBytes) {
							const remain = Math.max(0, limitBytes - total);
							if (remain > 0) text += decoder.decode(value.slice(0, remain), { stream: true });
							truncated = true;
							await reader.cancel();
							break;
						}

						total += value.length;
						text += decoder.decode(value, { stream: true });
					}
					text += decoder.decode();
				} else {
					const full = await res.text();
					text = full.slice(0, limitBytes);
					truncated = full.length > limitBytes;
				}

				setTextPreview({ loading: false, text, truncated });
			} catch (e: any) {
				if (e?.name === "AbortError") return;
				setTextPreview({ loading: false, text: "", truncated: false, error: e?.message || "加载失败" });
			}
		})();

		return () => controller.abort();
	}, [open, url, kind]);

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
			) : kind === "text" ? (
				<div className="space-y-3">
					<div className="text-xs text-muted-foreground">
						{item?.contentType ? `Content-Type：${item.contentType}` : "Content-Type：-"}
						{item?.extension ? `，扩展名：${item.extension}` : ""}
					</div>
					{textPreview.loading ? (
						<div className="text-sm text-muted-foreground">正在加载文本预览…</div>
					) : textPreview.error ? (
						<div className="space-y-2">
							<div className="text-sm text-destructive">加载失败：{textPreview.error}</div>
							<a href={url} target="_blank" rel="noreferrer">
								在新标签页打开
							</a>
						</div>
					) : (
						<div className="space-y-2">
							{textPreview.truncated ? (
								<div className="text-xs text-muted-foreground">
									已截断，仅展示前 {Math.floor(200_000 / 1000)}KB。可在新标签页打开查看完整内容。
								</div>
							) : null}
							<pre className="w-full max-h-[70vh] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
								{textPreview.text || "（空文件）"}
							</pre>
							<a href={url} target="_blank" rel="noreferrer">
								在新标签页打开
							</a>
						</div>
					)}
				</div>
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
