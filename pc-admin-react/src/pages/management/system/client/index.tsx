import { systemClientService, type SysClientRow, type SysClientSaveReq } from "@/api/services/systemClientService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import ClientFormDialog from "./client-form-dialog";

export default function ClientPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [clientType, setClientType] = useState("");
	const [authType, setAuthType] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [query, setQuery] = useState<{ clientType?: string; authType?: string[]; status?: number }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemClient.page", page, pageSize, query],
		queryFn: () =>
			systemClientService.page({
				page,
				size: pageSize,
				clientType: query.clientType,
				authType: query.authType,
				status: query.status,
			}),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysClientSaveReq) => systemClientService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemClient.page"] });
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysClientSaveReq }) => systemClientService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemClient.page"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemClientService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemClient.page"] });
		},
	});

	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "update">("create");
	const [editingId, setEditingId] = useState<number | null>(null);

	const onSubmit = async (payload: SysClientSaveReq) => {
		try {
			if (formMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (formMode === "update" && editingId) {
				await updateMutation.mutateAsync({ id: Number(editingId), payload });
				toast.success("保存成功", { position: "top-center" });
			}
			setFormOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	const columns: ColumnsType<SysClientRow> = useMemo(
		() => [
			{ title: "ClientId", dataIndex: "clientId", width: 220, ellipsis: true },
			{ title: "Type", dataIndex: "clientType", width: 120 },
			{
				title: "AuthType",
				dataIndex: "authType",
				width: 220,
				render: (v: string[]) => (Array.isArray(v) ? v.join(",") : ""),
			},
			{ title: "ActiveTimeout", dataIndex: "activeTimeout", width: 130 },
			{ title: "Timeout", dataIndex: "timeout", width: 110 },
			{
				title: "Status",
				dataIndex: "status",
				width: 110,
				render: (v: number) => (Number(v) === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ title: "Created", dataIndex: "createTime", width: 180 },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
			{
				title: "操作",
				key: "actions",
				width: 180,
				fixed: "right",
				render: (_: any, record: SysClientRow) => (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:client:update") || updateMutation.isPending}
							onClick={() => {
								setFormMode("update");
								setEditingId(Number(record.id));
								setFormOpen(true);
							}}
						>
							编辑
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:client:delete") || deleteMutation.isPending}
							onClick={() => {
								Modal.confirm({
									title: "确认删除？",
									content: `客户端：${record.clientId}`,
									okText: "删除",
									cancelText: "取消",
									okButtonProps: { danger: true },
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
		[can, deleteMutation, updateMutation.isPending],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Client</div>
					<div className="flex flex-wrap items-center gap-2">
						{can("system:client:create") && (
							<Button
								onClick={() => {
									setFormMode("create");
									setEditingId(null);
									setFormOpen(true);
								}}
							>
								新增
							</Button>
						)}
						<Input value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="ClientType" className="w-[160px]" />
						<Input
							value={authType}
							onChange={(e) => setAuthType(e.target.value)}
							placeholder="AuthType (comma separated)"
							className="w-[220px]"
						/>
						<Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" className="w-[110px]" />
						<Button
							onClick={() => {
								const s = Number(status.trim());
								const auth = authType
									.split(",")
									.map((x) => x.trim())
									.filter(Boolean);
								setPage(1);
								setQuery({
									clientType: clientType.trim() || undefined,
									authType: auth.length ? auth : undefined,
									status: Number.isFinite(s) && s >= 0 ? s : undefined,
								});
							}}
						>
							Search
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								setClientType("");
								setAuthType("");
								setStatus("");
								setPage(1);
								setQuery({});
							}}
						>
							Reset
						</Button>
						<Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["systemClient.page"] })}>
							Refresh
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysClientRow>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isFetching}
					pagination={{
						current: page,
						pageSize,
						total: data?.total || 0,
						showSizeChanger: true,
						onChange: (p, s) => {
							setPage(p);
							setPageSize(s);
						},
					}}
					columns={columns}
					dataSource={data?.list || []}
				/>
				<ClientFormDialog
					open={formOpen}
					mode={formMode}
					id={editingId}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setFormOpen}
					onSubmit={onSubmit}
				/>
			</CardContent>
		</Card>
	);
}
