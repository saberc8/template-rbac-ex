// 文件管理-主区域：目录/类型双模式、面包屑、上传/新建/批量、列表/宫格与操作弹窗。

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UploadProps } from "antd";
import { Breadcrumb, Empty, Pagination, Segmented, Upload } from "antd";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type SysFileRow, systemFileService } from "@/api/services/systemFileService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import { buildBreadcrumbList, fileTypeName, joinParentPath, normalizeParentPath } from "@/constants/file";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import CreateDirModal from "./components/CreateDirModal";
import FileDetailModal from "./components/FileDetailModal";
import FileGrid from "./components/FileGrid";
import FileList from "./components/FileList";
import FilePreviewModal from "./components/FilePreviewModal";
import FileRenameModal from "./components/FileRenameModal";

type ViewMode = "list" | "grid";

const sortFiles = (items: SysFileRow[]) => {
	const list = Array.isArray(items) ? [...items] : [];
	list.sort((a, b) => {
		const at = Number(a.type || 0);
		const bt = Number(b.type || 0);
		if (at === 0 && bt !== 0) return -1;
		if (at !== 0 && bt === 0) return 1;
		const au = String(a.updateTime || "");
		const bu = String(b.updateTime || "");
		if (au === bu) return 0;
		return au > bu ? -1 : 1;
	});
	return list;
};

export default function FileMain({ fileType }: { fileType: number }) {
	const queryClient = useQueryClient();
	const isDirMode = fileType === 0;
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [isBatchMode, setIsBatchMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<number[]>([]);

	const [originalNameInput, setOriginalNameInput] = useState("");
	const [originalName, setOriginalName] = useState("");
	const [parentPath, setParentPath] = useState<string>("/");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);

	const [createDirOpen, setCreateDirOpen] = useState(false);
	const [detailOpen, setDetailOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [activeItem, setActiveItem] = useState<SysFileRow | null>(null);

	useEffect(() => {
		setIsBatchMode(false);
		setSelectedIds([]);
		setOriginalNameInput("");
		setOriginalName("");
		setPage(1);
		setPageSize(30);
		if (isDirMode) {
			setParentPath("/");
		} else {
			setParentPath("/");
		}
	}, [isDirMode]);

	const query = useMemo(() => {
		if (isDirMode) {
			return {
				page,
				size: pageSize,
				originalName: originalName.trim() || undefined,
				type: undefined,
				parentPath: normalizeParentPath(parentPath),
			};
		}
		return {
			page,
			size: pageSize,
			originalName: originalName.trim() || undefined,
			type: fileType > 0 ? fileType : undefined,
			parentPath: undefined,
		};
	}, [fileType, isDirMode, originalName, page, pageSize, parentPath]);

	const { data, isFetching } = useQuery({
		queryKey: ["systemFile.page", query],
		queryFn: () => systemFileService.page(query),
	});

	const list = useMemo(() => sortFiles(data?.list || []), [data?.list]);
	const total = data?.total || 0;

	const invalidateAll = () => {
		queryClient.invalidateQueries({ queryKey: ["systemFile.page"] });
		queryClient.invalidateQueries({ queryKey: ["systemFile.statistics"] });
	};

	const uploadMutation = useMutation({
		mutationFn: (payload: {
			file: File;
			parentPath: string;
			signal: AbortSignal;
			onProgress?: (percent: number) => void;
		}) =>
			systemFileService.upload(payload.file, payload.parentPath, {
				signal: payload.signal,
				onProgress: payload.onProgress,
			}),
		onSuccess: () => {
			toast.success("上传成功", { position: "top-center" });
			invalidateAll();
		},
	});

	const handleUpload: NonNullable<UploadProps["customRequest"]> = (options) => {
		const controller = new AbortController();
		const file = options.file as File;
		const targetParentPath = isDirMode ? normalizeParentPath(parentPath) : "/";
		uploadMutation.mutate(
			{
				file,
				parentPath: targetParentPath,
				signal: controller.signal,
				onProgress: (percent) => options.onProgress?.({ percent }),
			},
			{
				onSuccess: (res) => options.onSuccess?.(res),
				onError: (err) => options.onError?.(err as any),
			},
		);
		return {
			abort() {
				controller.abort();
			},
		};
	};

	const createDirMutation = useMutation({
		mutationFn: (payload: { parentPath: string; originalName: string }) =>
			systemFileService.createDir(payload.parentPath, payload.originalName),
		onSuccess: () => {
			toast.success("新建文件夹成功", { position: "top-center" });
			invalidateAll();
		},
	});

	const renameMutation = useMutation({
		mutationFn: (payload: { id: number; originalName: string }) =>
			systemFileService.rename(payload.id, payload.originalName),
		onSuccess: () => {
			toast.success("重命名成功", { position: "top-center" });
			invalidateAll();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemFileService.delete(ids),
		onSuccess: () => {
			toast.success("删除成功", { position: "top-center" });
			invalidateAll();
		},
	});

	const busy =
		isFetching ||
		uploadMutation.isPending ||
		createDirMutation.isPending ||
		renameMutation.isPending ||
		deleteMutation.isPending;

	const breadcrumbs = useMemo(() => buildBreadcrumbList(parentPath), [parentPath]);

	const onEnterDir = (item: SysFileRow) => {
		if (!isDirMode) return;
		if (Number(item.type) !== 0) return;
		const dirName = String(item.name || item.originalName || "").trim();
		if (!dirName) return;
		setPage(1);
		setParentPath((p) => joinParentPath(p, dirName));
	};

	const onPreview = (item: SysFileRow) => {
		setActiveItem(item);
		setPreviewOpen(true);
	};
	const onDetail = (item: SysFileRow) => {
		setActiveItem(item);
		setDetailOpen(true);
	};
	const onRename = (item: SysFileRow) => {
		setActiveItem(item);
		setRenameOpen(true);
	};

	const onDownload = async (item: SysFileRow) => {
		const url = String(item.url || "").trim();
		if (!url) {
			toast.error("文件 URL 为空", { position: "top-center" });
			return;
		}
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error("fetch failed");
			const blob = await res.blob();
			const objectUrl = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = objectUrl;
			a.download = item.originalName || "download";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(objectUrl);
		} catch {
			window.open(url, "_blank", "noreferrer");
		}
	};

	const onDelete = async (ids: number[]) => {
		if (!ids.length) return;
		const ok = await confirm({
			title: "提示",
			description: `是否确定删除所选的 ${ids.length} 个文件？`,
			confirmText: "删除",
			destructive: true,
		});
		if (!ok) return;
		try {
			await deleteMutation.mutateAsync(ids);
			setSelectedIds([]);
			setIsBatchMode(false);
		} catch {
			// handled by apiClient
		}
	};

	const headerLeft = (
		<div className="flex items-center gap-2 flex-wrap">
			<Upload showUploadList={false} customRequest={handleUpload} disabled={busy} maxCount={1} multiple={false}>
				<Button type="button" disabled={busy}>
					上传
				</Button>
			</Upload>

			<Input
				value={originalNameInput}
				onChange={(e) => setOriginalNameInput(e.target.value)}
				placeholder={isDirMode ? "在当前目录下搜索名称" : "请输入名称"}
				className="w-[220px]"
			/>
			<Button
				type="button"
				disabled={busy}
				onClick={() => {
					setPage(1);
					setOriginalName(originalNameInput.trim());
				}}
			>
				查询
			</Button>
		</div>
	);

	const headerRight = (
		<div className="flex items-center gap-2 flex-wrap justify-end">
			{isBatchMode ? (
				<Button
					type="button"
					variant="destructive"
					disabled={!selectedIds.length || busy}
					onClick={() => onDelete(selectedIds)}
				>
					批量删除{selectedIds.length ? `（${selectedIds.length}）` : ""}
				</Button>
			) : null}

			{isDirMode ? (
				<Button type="button" variant="secondary" disabled={busy} onClick={() => setCreateDirOpen(true)}>
					新建文件夹
				</Button>
			) : null}

			<Button type="button" variant="secondary" disabled={busy} onClick={() => setIsBatchMode((v) => !v)}>
				{isBatchMode ? "取消批量" : "批量操作"}
			</Button>

			<Segmented
				size="small"
				value={viewMode}
				options={[
					{ label: "列表", value: "list" },
					{ label: "宫格", value: "grid" },
				]}
				onChange={(v) => setViewMode(v as ViewMode)}
			/>
		</div>
	);

	return (
		<Card className="h-full min-h-0 flex flex-col">
			<CardHeader className="pb-3">
				{isDirMode ? (
					<div className="mb-3">
						<Breadcrumb>
							<Breadcrumb.Item
								onClick={() => {
									setParentPath("/");
									setPage(1);
								}}
								className="cursor-pointer"
							>
								根目录
							</Breadcrumb.Item>
							{breadcrumbs.map((b) => (
								<Breadcrumb.Item
									key={b.path}
									onClick={() => {
										setParentPath(b.path);
										setPage(1);
									}}
									className="cursor-pointer"
								>
									{b.name}
								</Breadcrumb.Item>
							))}
						</Breadcrumb>
					</div>
				) : (
					<div className="mb-3 text-sm text-muted-foreground">当前筛选：{fileTypeName(fileType)}</div>
				)}

				<div className="flex items-center justify-between gap-3 flex-wrap">
					{headerLeft}
					{headerRight}
				</div>
			</CardHeader>

			<CardContent className="flex-1 min-h-0 overflow-auto">
				{viewMode === "list" ? (
					<FileList
						loading={isFetching}
						data={list}
						page={page}
						pageSize={pageSize}
						total={total}
						isDirMode={isDirMode}
						isBatchMode={isBatchMode}
						selectedIds={selectedIds}
						onSelectedIdsChange={setSelectedIds}
						onPageChange={(p, s) => {
							setPage(p);
							setPageSize(s);
						}}
						onEnterDir={onEnterDir}
						onPreview={onPreview}
						onDetail={onDetail}
						onRename={onRename}
						onDownload={onDownload}
						onDelete={(id) => onDelete([id])}
					/>
				) : (
					<div className="space-y-4">
						<FileGrid
							loading={isFetching}
							data={list}
							isDirMode={isDirMode}
							isBatchMode={isBatchMode}
							selectedIds={selectedIds}
							onSelectedIdsChange={setSelectedIds}
							onEnterDir={onEnterDir}
							onPreview={onPreview}
							onDetail={onDetail}
							onRename={onRename}
							onDownload={onDownload}
							onDelete={(id) => onDelete([id])}
						/>
						{isFetching ? null : list.length ? (
							<div className="flex justify-end">
								<Pagination
									current={page}
									pageSize={pageSize}
									total={total}
									showSizeChanger
									onChange={(p, s) => {
										setPage(p);
										setPageSize(s);
									}}
								/>
							</div>
						) : (
							<Empty />
						)}
					</div>
				)}
			</CardContent>

			<CreateDirModal
				open={createDirOpen}
				busy={busy}
				parentPath={normalizeParentPath(parentPath)}
				onOpenChange={setCreateDirOpen}
				onCreate={async (name) => {
					try {
						await createDirMutation.mutateAsync({ parentPath: normalizeParentPath(parentPath), originalName: name });
						setCreateDirOpen(false);
					} catch {
						// handled by apiClient
					}
				}}
			/>

			<FileDetailModal open={detailOpen} item={activeItem} onOpenChange={setDetailOpen} />

			<FileRenameModal
				open={renameOpen}
				item={activeItem}
				busy={busy}
				onOpenChange={setRenameOpen}
				onRename={async (name) => {
					if (!activeItem?.id) return;
					try {
						await renameMutation.mutateAsync({ id: activeItem.id, originalName: name });
						setRenameOpen(false);
					} catch {
						// handled by apiClient
					}
				}}
			/>

			<FilePreviewModal open={previewOpen} item={activeItem} onOpenChange={setPreviewOpen} />
			{ConfirmDialog}
		</Card>
	);
}
