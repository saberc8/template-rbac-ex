// 文件管理-宫格视图：卡片展示 + 批量选择 + 操作入口。

import type { SysFileRow } from "@/api/services/systemFileService";
import { guessPreviewKind } from "@/constants/file";
import { Skeleton, Dropdown } from "antd";
import { useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";

const isSelected = (ids: number[], id: number) => ids.includes(id);

export default function FileGrid({
	loading,
	data,
	isDirMode,
	isBatchMode,
	selectedIds,
	onSelectedIdsChange,
	onEnterDir,
	onPreview,
	onDetail,
	onRename,
	onDownload,
	onDelete,
}: {
	loading: boolean;
	data: SysFileRow[];
	isDirMode: boolean;
	isBatchMode: boolean;
	selectedIds: number[];
	onSelectedIdsChange: (ids: number[]) => void;
	onEnterDir: (item: SysFileRow) => void;
	onPreview: (item: SysFileRow) => void;
	onDetail: (item: SysFileRow) => void;
	onRename: (item: SysFileRow) => void;
	onDownload: (item: SysFileRow) => void;
	onDelete: (id: number) => void;
}) {
	const cards = useMemo(() => data || [], [data]);

	const toggle = (id: number) => {
		onSelectedIdsChange(isSelected(selectedIds, id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
	};

	if (loading) {
		return <Skeleton active paragraph={{ rows: 8 }} />;
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
			{cards.map((it) => {
				const isDir = Number(it.type) === 0;
				const url = (it.url || "").trim();
				const kind = guessPreviewKind(it.extension, it.contentType);

				const onCardClick = () => {
					if (isBatchMode) {
						toggle(it.id);
						return;
					}
					if (!isDir) onPreview(it);
				};

				return (
					<div
						key={it.id}
						className="relative border rounded-md overflow-hidden bg-background hover:bg-accent/40 transition cursor-pointer"
						onDoubleClick={() => {
							if (isBatchMode) return;
							if (isDir && isDirMode) onEnterDir(it);
						}}
						onClick={onCardClick}
					>
						{isBatchMode ? (
							<input
								type="checkbox"
								className="absolute left-2 top-2 z-10"
								checked={isSelected(selectedIds, it.id)}
								onChange={() => toggle(it.id)}
								onClick={(e) => e.stopPropagation()}
							/>
						) : null}

						<div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
							<Dropdown
								trigger={["click"]}
								menu={{
									items: [
										!isDir ? { key: "preview", label: "预览" } : null,
										{ key: "detail", label: "详情" },
										{ key: "rename", label: "重命名" },
										!isDir ? { key: "download", label: "下载" } : null,
										{ key: "delete", label: "删除" },
									].filter(Boolean) as any[],
									onClick: ({ key }) => {
										if (key === "preview") onPreview(it);
										if (key === "detail") onDetail(it);
										if (key === "rename") onRename(it);
										if (key === "download") onDownload(it);
										if (key === "delete") onDelete(it.id);
									},
								}}
							>
								<Button type="button" size="icon" variant="secondary">
									<Icon icon="solar:menu-dots-bold" size={18} />
								</Button>
							</Dropdown>
						</div>

						<div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
							{isDir ? (
								<Icon icon="solar:folder-with-files-bold-duotone" size={42} />
							) : kind === "image" && url ? (
								<img src={url} alt={it.originalName} className="w-full h-full object-cover" />
							) : kind === "video" ? (
								<Icon icon="solar:video-frame-bold-duotone" size={42} />
							) : kind === "audio" ? (
								<Icon icon="solar:music-notes-bold-duotone" size={42} />
							) : kind === "pdf" ? (
								<Icon icon="solar:file-text-bold-duotone" size={42} />
							) : (
								<Icon icon="solar:file-bold-duotone" size={42} />
							)}
						</div>

						<div className="p-2">
							<div className="text-sm font-medium truncate" title={it.originalName}>
								{it.originalName}
							</div>
							<div className="text-xs text-muted-foreground truncate" title={it.parentPath}>
								{it.parentPath || "-"}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
