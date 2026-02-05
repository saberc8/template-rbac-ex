// 文件管理-列表视图：Table + 批量选择 + 行内操作。

import type { SysFileRow } from "@/api/services/systemFileService";
import { Dropdown, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { fBytes } from "@/utils/format-number";
import { fileTypeName } from "@/constants/file";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";

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
	const columns: ColumnsType<SysFileRow> = useMemo(
		() => [
			{
				title: "名称",
				dataIndex: "originalName",
				width: 320,
				render: (_: any, record: SysFileRow) => {
					const isDir = Number(record.type) === 0;
					return (
						<div className="flex items-center gap-2">
							<Icon icon={isDir ? "solar:folder-with-files-bold-duotone" : "solar:file-bold-duotone"} size={18} />
							<span className={isDir && isDirMode ? "cursor-pointer text-primary" : ""}>{record.originalName}</span>
						</div>
					);
				},
			},
			{ title: "父目录", dataIndex: "parentPath", width: 220, ellipsis: true },
			{
				title: "类型",
				dataIndex: "type",
				width: 90,
				render: (v: any) => (Number(v) === 0 ? "目录" : fileTypeName(Number(v))),
			},
			{
				title: "大小",
				dataIndex: "size",
				width: 120,
				align: "right",
				render: (v: any, record: SysFileRow) => (Number(record.type) === 0 ? "-" : v != null ? fBytes(v) : "-"),
			},
			{ title: "存储", dataIndex: "storageName", width: 140, ellipsis: true },
			{ title: "更新时间", dataIndex: "updateTime", width: 180 },
			{
				title: "操作",
				key: "actions",
				width: 120,
				fixed: "right",
				render: (_: any, record: SysFileRow) => {
					const isDir = Number(record.type) === 0;
					const items = [
						!isDir
							? {
									key: "preview",
									label: "预览",
								}
							: null,
						{ key: "detail", label: "详情" },
						{ key: "rename", label: "重命名" },
						!isDir
							? {
									key: "download",
									label: "下载",
								}
							: null,
						{ key: "delete", label: "删除" },
					].filter(Boolean) as any[];

					return (
						<Dropdown
							trigger={["click"]}
							menu={{
								items,
								onClick: ({ key }) => {
									if (key === "preview") onPreview(record);
									if (key === "detail") onDetail(record);
									if (key === "rename") onRename(record);
									if (key === "download") onDownload(record);
									if (key === "delete") onDelete(record.id);
								},
							}}
						>
							<Button type="button" variant="secondary" size="sm">
								更多
							</Button>
						</Dropdown>
					);
				},
			},
		],
		[isDirMode, onDelete, onDetail, onDownload, onPreview, onRename],
	);

	return (
		<Table<SysFileRow>
			rowKey="id"
			size="small"
			scroll={{ x: "max-content" }}
			loading={loading}
			rowSelection={
				isBatchMode
					? {
							selectedRowKeys: selectedIds,
							onChange: (keys) => onSelectedIdsChange(keys as number[]),
						}
					: undefined
			}
			onRow={(record) => ({
				onDoubleClick: () => {
					if (isBatchMode) return;
					if (isDirMode && Number(record.type) === 0) onEnterDir(record);
					else onPreview(record);
				},
			})}
			pagination={{
				current: page,
				pageSize,
				total,
				showSizeChanger: true,
				onChange: (p, s) => onPageChange(p, s),
			}}
			columns={columns}
			dataSource={data}
		/>
	);
}
