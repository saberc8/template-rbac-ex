import { systemDeptService, type SysDeptNode, type SysDeptSaveReq } from "@/api/services/systemDeptService";
import { useUserPermissions } from "@/store/userStore";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { BasicStatus } from "#/enum";
import { toast } from "sonner";
import DeptFormDialog from "./dept-form-dialog";

const stripEmptyChildren = (nodes: SysDeptNode[]): SysDeptNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

export default function OrganizationPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [queryStatus, setQueryStatus] = useState<number | undefined>(undefined);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysDeptNode | null>(null);
	const [defaultParentId, setDefaultParentId] = useState<number>(0);

	const { data, isFetching } = useQuery({
		queryKey: ["systemDept.tree", queryKeyword, queryStatus],
		queryFn: () => systemDeptService.tree({ description: queryKeyword || undefined, status: queryStatus }),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysDeptSaveReq) => systemDeptService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysDeptSaveReq }) => systemDeptService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemDeptService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const exportMutation = useMutation({
		mutationFn: () => systemDeptService.exportCsv({ description: queryKeyword || undefined, status: queryStatus }),
	});

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		window.URL.revokeObjectURL(url);
	};

	const columns: ColumnsType<SysDeptNode> = useMemo(
		() => [
			{ title: "名称", dataIndex: "name", width: 260 },
			{ title: "排序", dataIndex: "sort", width: 80 },
			{
				title: "状态",
				dataIndex: "status",
				width: 120,
				render: (v: number) => (v === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ title: "描述", dataIndex: "description" },
			{
				title: "操作",
				key: "actions",
				width: 220,
				fixed: "right",
				render: (_: any, record: SysDeptNode) => {
					const id = Number(record.id);
					const hasChildren = (record.children?.length ?? 0) > 0;
					return (
						<div className="flex items-center gap-2">
							{can("system:dept:create") && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => {
										setDialogMode("create");
										setEditing(null);
										setDefaultParentId(id);
										setDialogOpen(true);
									}}
								>
									新增子级
								</Button>
							)}
							{can("system:dept:update") && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => {
										setDialogMode("update");
										setEditing(record);
										setDefaultParentId(Number(record.parentId) || 0);
										setDialogOpen(true);
									}}
								>
									编辑
								</Button>
							)}
							{can("system:dept:delete") && (
								<Button
									size="sm"
									variant="destructive"
									disabled={Boolean(record.isSystem) || hasChildren}
									onClick={() => {
										Modal.confirm({
											title: "确认删除？",
											content: hasChildren ? "存在下级部门，不允许删除。" : "删除后不可恢复。",
											okText: "删除",
											cancelText: "取消",
											okButtonProps: { danger: true, disabled: Boolean(record.isSystem) || hasChildren },
											onOk: async () => {
												try {
													await deleteMutation.mutateAsync([id]);
													toast.success("删除成功", { position: "top-center" });
												} catch {
													// handled by apiClient
												}
											},
										});
									}}
								>
									删除
								</Button>
							)}
						</div>
					);
				},
			},
		],
		[can, deleteMutation],
	);

	const onSubmitDialog = async (payload: SysDeptSaveReq) => {
		try {
			if (dialogMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (dialogMode === "update" && editing) {
				await updateMutation.mutateAsync({ id: Number(editing.id), payload });
				toast.success("保存成功", { position: "top-center" });
			}
			setDialogOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>部门管理</div>
					<div className="flex flex-wrap items-center gap-2">
						{can("system:dept:create") && (
							<Button
								onClick={() => {
									const firstRootId = Number((data || [])[0]?.id) || 0;
									setDialogMode("create");
									setEditing(null);
									setDefaultParentId(firstRootId);
									setDialogOpen(true);
								}}
							>
								新增
							</Button>
						)}
						{can("system:dept:export") && (
							<Button
								variant="secondary"
								disabled={exportMutation.isPending}
								onClick={async () => {
									try {
										const blob = await exportMutation.mutateAsync();
										downloadBlob(blob, "dept_export.csv");
									} catch {
										// handled by apiClient
									}
								}}
							>
								导出
							</Button>
						)}
						<Button
							variant="secondary"
							onClick={() => {
								queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
							}}
						>
							刷新
						</Button>
						<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="名称/描述" className="w-[220px]" />
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status ?? ""}
							onChange={(e) => {
								const v = e.target.value === "" ? undefined : Number(e.target.value);
								setStatus(v);
							}}
						>
							<option value="">全部状态</option>
							<option value={BasicStatus.ENABLE}>启用</option>
							<option value={BasicStatus.DISABLE}>禁用</option>
						</select>
						<Button
							onClick={() => {
								setQueryKeyword(keyword.trim());
								setQueryStatus(status);
							}}
						>
							查询
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								setKeyword("");
								setStatus(undefined);
								setQueryKeyword("");
								setQueryStatus(undefined);
							}}
						>
							重置
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysDeptNode>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					pagination={false}
					loading={isFetching}
					columns={columns}
					dataSource={stripEmptyChildren(data || [])}
					expandable={{
						rowExpandable: (record) => (record.children?.length ?? 0) > 0,
					}}
				/>
				<DeptFormDialog
					open={dialogOpen}
					mode={dialogMode}
					tree={stripEmptyChildren(data || [])}
					initial={editing}
					defaultParentId={defaultParentId}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setDialogOpen}
					onSubmit={onSubmitDialog}
				/>
			</CardContent>
		</Card>
	);
}
