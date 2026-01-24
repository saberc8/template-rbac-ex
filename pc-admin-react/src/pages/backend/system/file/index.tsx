// 后端路由页面：系统管理-文件管理（对齐 pc-admin-vue3：目录导航 + 上传/新建文件夹/重命名/删除/下载）。

import systemFileService from "@/api/services/systemFileService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Form, Modal, Select, Table, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { FileDirCreateReq, FileItem, FileUpdateReq } from "#/system";

const formatSize = (size?: number | null) => {
	if (!size || size <= 0) return "-";
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const normalizeParentPath = (p: string) => {
	const trimmed = p.trim();
	if (!trimmed) return "/";
	if (!trimmed.startsWith("/")) return `/${trimmed}`;
	return trimmed === "/" ? "/" : trimmed.replace(/\/+$/, "");
};

const parentOf = (p: string) => {
	const n = normalizeParentPath(p);
	if (n === "/") return "/";
	const idx = n.lastIndexOf("/");
	if (idx <= 0) return "/";
	return n.slice(0, idx) || "/";
};

export default function BackendSystemFilePage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canUpload = checkAny(["system:file:upload"]);
	const canCreateDir = checkAny(["system:file:createDir"]);
	const canUpdate = checkAny(["system:file:update"]);
	const canDelete = checkAny(["system:file:delete"]);
	const canDownload = checkAny(["system:file:download"]);

	const [page, setPage] = useState(1);
	const [size, setSize] = useState(30);
	const [originalName, setOriginalName] = useState("");
	const [currentPath, setCurrentPath] = useState("/");
	const [type, setType] = useState<number | undefined>(undefined);

	const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

	const [dirModalOpen, setDirModalOpen] = useState(false);
	const [dirForm] = Form.useForm<FileDirCreateReq>();

	const [renameModalOpen, setRenameModalOpen] = useState(false);
	const [renaming, setRenaming] = useState<FileItem | null>(null);
	const [renameForm] = Form.useForm<FileUpdateReq>();

	const normalizedPath = useMemo(() => normalizeParentPath(currentPath), [currentPath]);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.file.page", page, size, originalName, normalizedPath, type],
		queryFn: () =>
			systemFileService.listFilePage({
				page,
				size,
				originalName: originalName || undefined,
				parentPath: normalizedPath || undefined,
				type,
			}),
	});

	const onUpload = async (options: any) => {
		try {
			const formData = new FormData();
			formData.append("file", options.file as any);
			formData.append("parentPath", normalizedPath);
			await systemFileService.uploadFile(formData);
			toast.success("上传成功");
			options.onSuccess?.({}, new XMLHttpRequest());
			refetch();
		} catch (e) {
			options.onError?.(e as any);
		}
	};

	const openCreateDir = () => {
		setDirModalOpen(true);
		dirForm.resetFields();
		dirForm.setFieldsValue({ parentPath: normalizedPath, name: "" });
	};

	const submitCreateDir = async () => {
		const values = await dirForm.validateFields();
		await systemFileService.createDir({ parentPath: normalizedPath, name: values.name });
		toast.success("创建成功");
		setDirModalOpen(false);
		refetch();
	};

	const openRename = (record: FileItem) => {
		setRenaming(record);
		setRenameModalOpen(true);
		renameForm.resetFields();
		renameForm.setFieldsValue({ name: record.name });
	};

	const submitRename = async () => {
		const values = await renameForm.validateFields();
		if (!renaming) return;
		await systemFileService.updateFile(renaming.id, { name: values.name });
		toast.success("重命名成功");
		setRenameModalOpen(false);
		setRenaming(null);
		refetch();
	};

	const deleteIds = async (ids: number[]) => {
		if (!ids.length) return;
		const ok = window.confirm(`确认删除选中的 ${ids.length} 项？`);
		if (!ok) return;
		await systemFileService.deleteFile(ids);
		toast.success("删除成功");
		setSelectedRowKeys([]);
		refetch();
	};

	const columns: ColumnsType<FileItem> = [
		{ title: "名称", dataIndex: "name", width: 240 },
		{ title: "原始名", dataIndex: "originalName", width: 220 },
		{ title: "路径", dataIndex: "path", width: 280 },
		{
			title: "类型",
			dataIndex: "type",
			width: 110,
			render: (v: number) =>
				v === 0 ? "文件夹" : v === 2 ? "图片" : v === 4 ? "视频" : v === 5 ? "音频" : v === 3 ? "文档" : "文件",
		},
		{
			title: "大小",
			dataIndex: "size",
			width: 120,
			render: (v?: number | null) => formatSize(v),
		},
		{ title: "存储", dataIndex: "storageName", width: 160 },
		{ title: "创建时间", dataIndex: "createTime", width: 190 },
		{
			title: "操作",
			key: "op",
			width: 280,
			fixed: "right",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					{record.type === 0 ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setCurrentPath(record.path);
								setPage(1);
								setSelectedRowKeys([]);
							}}
						>
							进入
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							disabled={!canDownload}
							onClick={() => {
								if (!record.url) {
									toast.error("文件 URL 为空");
									return;
								}
								window.open(record.url, "_blank", "noopener,noreferrer");
							}}
						>
							下载
						</Button>
					)}

					<Button variant="outline" size="sm" onClick={() => openRename(record)} disabled={!canUpdate}>
						重命名
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canDelete}
						onClick={() => deleteIds([record.id])}
					>
						删除
					</Button>
				</div>
			),
		},
	];

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">文件管理</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
							<div className="mt-1 text-xs text-text-secondary">当前目录：{normalizedPath}</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								onClick={() => {
									const p = parentOf(normalizedPath);
									setCurrentPath(p);
									setPage(1);
									setSelectedRowKeys([]);
								}}
								disabled={normalizedPath === "/"}
							>
								返回上级
							</Button>
							<Upload showUploadList={false} customRequest={onUpload} disabled={!canUpload}>
								<Button variant="outline" disabled={!canUpload}>
									上传
								</Button>
							</Upload>
							<Button variant="outline" onClick={openCreateDir} disabled={!canCreateDir}>
								新建文件夹
							</Button>
							<Button
								variant="outline"
								disabled={!canDelete || !selectedRowKeys.length}
								onClick={() => deleteIds(selectedRowKeys)}
							>
								批量删除
							</Button>
							<Input value={originalName} onChange={(e) => setOriginalName(e.target.value)} placeholder="原始文件名关键字" className="w-56" />
							<Select
								value={type}
								onChange={(v) => setType(v)}
								allowClear
								placeholder="类型"
								className="w-32"
								options={[
									{ label: "图片", value: 2 },
									{ label: "文档", value: 3 },
									{ label: "视频", value: 4 },
									{ label: "音频", value: 5 },
									{ label: "文件", value: 1 },
								]}
							/>
							<Button variant="outline" onClick={() => refetch()}>
								刷新
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<FileItem>
						rowKey="id"
						size="small"
						loading={isFetching}
						scroll={{ x: "max-content" }}
						columns={columns}
						dataSource={data?.list || []}
						rowSelection={{
							selectedRowKeys,
							onChange: (keys) => setSelectedRowKeys(keys as number[]),
						}}
						onRow={(record) => ({
							onDoubleClick: () => {
								if (record.type === 0) {
									setCurrentPath(record.path);
									setPage(1);
									setSelectedRowKeys([]);
								} else if (record.url) {
									window.open(record.url, "_blank", "noopener,noreferrer");
								}
							},
						})}
						pagination={{
							current: page,
							pageSize: size,
							total: data?.total || 0,
							showSizeChanger: true,
							onChange: (nextPage, nextSize) => {
								setPage(nextPage);
								setSize(nextSize);
							},
						}}
					/>
				</CardContent>
			</Card>

			<Modal
				open={dirModalOpen}
				title="新建文件夹"
				onCancel={() => setDirModalOpen(false)}
				onOk={submitCreateDir}
				okButtonProps={{ disabled: !canCreateDir }}
				destroyOnClose
				width={560}
			>
				<Form form={dirForm} layout="vertical" preserve={false}>
					<Form.Item name="name" label="文件夹名称" rules={[{ required: true, message: "请输入文件夹名称" }]}>
						<Input />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				open={renameModalOpen}
				title="重命名"
				onCancel={() => {
					setRenameModalOpen(false);
					setRenaming(null);
				}}
				onOk={submitRename}
				okButtonProps={{ disabled: !canUpdate }}
				destroyOnClose
				width={560}
			>
				<Form form={renameForm} layout="vertical" preserve={false}>
					<Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
						<Input />
					</Form.Item>
				</Form>
			</Modal>
		</>
	);
}
