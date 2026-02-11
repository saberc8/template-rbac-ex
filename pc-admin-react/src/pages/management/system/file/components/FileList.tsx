// 文件管理-列表视图：Table + 批量选择 + 行内操作。

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { SysFileRow } from "@/api/services/systemFileService";
import DataTable from "@/components/data-table/data-table";
import { Icon } from "@/components/icon";
import { fileTypeName } from "@/constants/file";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { fBytes } from "@/utils/format-number";

export default function FileList({
	loading,
	data,
	page,
	pageSize,
	total,
	isDirMode,
	isBatchMode,
	selectedIds,
	onSelectedIdsChange,
	onPageChange,
	onEnterDir,
	onPreview,
	onDetail,
	onRename,
	onDownload,
	onDelete,
}: {
	loading: boolean;
	data: SysFileRow[];
	page: number;
	pageSize: number;
	total: number;
	isDirMode: boolean;
	isBatchMode: boolean;
	selectedIds: number[];
	onSelectedIdsChange: (ids: number[]) => void;
	onPageChange: (page: number, size: number) => void;
	onEnterDir: (item: SysFileRow) => void;
	onPreview: (item: SysFileRow) => void;
	onDetail: (item: SysFileRow) => void;
	onRename: (item: SysFileRow) => void;
	onDownload: (item: SysFileRow) => void;
	onDelete: (id: number) => void;
}) {
	const columns: Array<ColumnDef<SysFileRow>> = useMemo(
		() => [
			{
				header: "名称",
				accessorKey: "originalName",
				size: 320,
				cell: ({ row }) => {
					const record = row.original;
					const isDir = Number(record.type) === 0;
					return (
						<div className="flex items-center gap-2">
							<Icon icon={isDir ? "solar:folder-with-files-bold-duotone" : "solar:file-bold-duotone"} size={18} />
							<span className={isDir && isDirMode ? "cursor-pointer text-primary" : ""}>{record.originalName}</span>
						</div>
					);
				},
			},
			{ header: "父目录", accessorKey: "parentPath", size: 220 },
			{
				header: "类型",
				accessorKey: "type",
				size: 90,
				meta: { align: "center" },
				cell: ({ row }) => (Number(row.original.type) === 0 ? "目录" : fileTypeName(Number(row.original.type))),
			},
			{
				header: "大小",
				accessorKey: "size",
				size: 120,
				meta: { align: "right" },
				cell: ({ row }) => {
					const record = row.original;
					const v = record.size;
					return Number(record.type) === 0 ? "-" : v != null ? fBytes(v) : "-";
				},
			},
			{ header: "存储", accessorKey: "storageName", size: 140 },
			{ header: "更新时间", accessorKey: "updateTime", size: 180 },
			{
				header: "操作",
				id: "actions",
				size: 140,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original;
					const isDir = Number(record.type) === 0;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="secondary" size="sm">
									更多
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{!isDir ? <DropdownMenuItem onClick={() => onPreview(record)}>预览</DropdownMenuItem> : null}
								<DropdownMenuItem onClick={() => onDetail(record)}>详情</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onRename(record)}>重命名</DropdownMenuItem>
								{!isDir ? <DropdownMenuItem onClick={() => onDownload(record)}>下载</DropdownMenuItem> : null}
								<DropdownMenuItem variant="destructive" onClick={() => onDelete(record.id)}>
									删除
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[isDirMode, onDelete, onDetail, onDownload, onPreview, onRename],
	);

	return (
		<DataTable<SysFileRow>
			columns={columns}
			data={data}
			loading={loading}
			getRowId={(row) => String(row.id)}
			selection={
				isBatchMode
					? {
							selectedRowIds: selectedIds,
							onSelectedRowIdsChange: (ids) =>
								onSelectedIdsChange(ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)),
						}
					: undefined
			}
			onRowDoubleClick={(record) => {
				if (isBatchMode) return;
				if (isDirMode && Number(record.type) === 0) onEnterDir(record);
				else onPreview(record);
			}}
			pagination={{
				page,
				pageSize,
				total,
				onChange: (p, s) => onPageChange(p, s),
				pageSizeOptions: [10, 20, 30, 50, 100],
			}}
		/>
	);
}
