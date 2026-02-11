import { systemStorageService, type SysStorageRow, type SysStorageSaveReq } from "@/api/services/systemStorageService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Switch } from "@/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import StorageFormDialog from "./storage-form-dialog";

export default function StoragePage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [description, setDescription] = useState("");
	const [type, setType] = useState("");
	const [query, setQuery] = useState<{ description?: string; type?: number }>({});
	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysStorageRow | null>(null);

	const { data, isFetching } = useQuery({
		queryKey: ["systemStorage.list", query],
		queryFn: () => systemStorageService.list(query),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysStorageSaveReq) => systemStorageService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] });
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysStorageSaveReq }) => systemStorageService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemStorageService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] });
		},
	});
	const statusMutation = useMutation({
		mutationFn: ({ id, status }: { id: number; status: number }) => systemStorageService.updateStatus(id, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] });
		},
	});
	const defaultMutation = useMutation({
		mutationFn: (id: number) => systemStorageService.setDefault(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] });
		},
	});

	const onSubmit = async (payload: SysStorageSaveReq) => {
		try {
			if (formMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (formMode === "update" && editing) {
				await updateMutation.mutateAsync({ id: Number(editing.id), payload });
				toast.success("保存成功", { position: "top-center" });
			}
			setFormOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	const columns: ColumnsType<SysStorageRow> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 240 },
			{ title: "Code", dataIndex: "code", width: 180 },
			{ title: "Type", dataIndex: "type", width: 120, render: (v: number) => (Number(v) === 2 ? "OSS/MinIO" : "本地") },
			{
				title: "Default",
				dataIndex: "isDefault",
				width: 90,
				render: (v: boolean) => (v ? "Yes" : "No"),
			},
			{
				title: "Status",
				dataIndex: "status",
				width: 120,
				render: (_: number, record) => (
					<div className="flex items-center gap-2">
						<Switch
							checked={Number(record.status) === BasicStatus.ENABLE}
							disabled={!can("system:storage:updateStatus") || record.isDefault || statusMutation.isPending}
							onCheckedChange={async (checked) => {
								try {
									await statusMutation.mutateAsync({
										id: Number(record.id),
										status: checked ? BasicStatus.ENABLE : BasicStatus.DISABLE,
									});
									toast.success("更新成功", { position: "top-center" });
								} catch {
									// handled by apiClient
								}
							}}
						/>
						<span className="text-xs text-muted-foreground">{Number(record.status) === BasicStatus.ENABLE ? "启用" : "禁用"}</span>
					</div>
				),
			},
			{ title: "Endpoint", dataIndex: "endpoint", width: 220, ellipsis: true },
			{ title: "Bucket", dataIndex: "bucketName", width: 160, ellipsis: true },
			{ title: "Domain", dataIndex: "domain", width: 220, ellipsis: true },
			{ title: "Desc", dataIndex: "description", width: 260, ellipsis: true },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
			{
				title: "操作",
				key: "actions",
				width: 260,
				fixed: "right",
				render: (_: any, record: SysStorageRow) => (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:storage:update") || updateMutation.isPending}
							onClick={() => {
								setFormMode("update");
								setEditing(record);
								setFormOpen(true);
							}}
						>
							编辑
						</Button>
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:storage:setDefault") || record.isDefault || defaultMutation.isPending}
							onClick={async () => {
								try {
									await defaultMutation.mutateAsync(Number(record.id));
									toast.success("设置默认成功", { position: "top-center" });
								} catch {
									// handled by apiClient
								}
							}}
						>
							设默认
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:storage:delete") || record.isDefault || deleteMutation.isPending}
							onClick={() => {
								Modal.confirm({
									title: "确认删除？",
									content: record.isDefault ? "默认存储不允许删除" : `存储：${record.name}`,
									okText: "删除",
									cancelText: "取消",
									okButtonProps: { danger: true, disabled: record.isDefault },
									onOk: async () => {
										try {
											await deleteMutation.mutateAsync([Number(record.id)]);
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
					</div>
				),
			},
		],
		[can, defaultMutation, deleteMutation, statusMutation.isPending, updateMutation.isPending],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Storage</div>
					<div className="flex flex-wrap items-center gap-2">
						{can("system:storage:create") && (
							<Button
								onClick={() => {
									setFormMode("create");
									setEditing(null);
									setFormOpen(true);
								}}
							>
								新增
							</Button>
						)}
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keyword" className="w-[220px]" />
						<Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type(1/2)" className="w-[110px]" />
						<Button
							onClick={() => {
								const t = Number(type.trim());
								setQuery({
									description: description.trim() || undefined,
									type: Number.isFinite(t) && t > 0 ? t : undefined,
								});
							}}
						>
							查询
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								setDescription("");
								setType("");
								setQuery({});
							}}
						>
							重置
						</Button>
						<Button
							variant="secondary"
							onClick={() => queryClient.invalidateQueries({ queryKey: ["systemStorage.list"] })}
						>
							刷新
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysStorageRow>
					rowKey="id"
					size="small"
					scroll={{ x: 1600 }}
					pagination={false}
					loading={isFetching}
					columns={columns}
					dataSource={data || []}
				/>
				<StorageFormDialog
					open={formOpen}
					mode={formMode}
					initial={editing}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setFormOpen}
					onSubmit={onSubmit}
				/>
			</CardContent>
		</Card>
	);
}
