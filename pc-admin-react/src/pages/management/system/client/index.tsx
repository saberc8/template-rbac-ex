import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import { type SysClientRow, type SysClientSaveReq, systemClientService } from "@/api/services/systemClientService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import ClientFormDialog from "./client-form-dialog";

export default function ClientPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [clientType, setClientType] = useState("");
	const [authType, setAuthType] = useState("");
	const [status, setStatus] = useState<string>("all");
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
	const { confirm, ConfirmDialog } = useConfirmDialog();

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

	const columns: Array<ColumnDef<SysClientRow>> = useMemo(
		() => [
			{ header: "ClientId", accessorKey: "clientId", size: 220 },
			{ header: "Type", accessorKey: "clientType", size: 120 },
			{
				header: "AuthType",
				accessorKey: "authType",
				size: 240,
				cell: ({ row }) => {
					const v = row.original.authType;
					return Array.isArray(v) ? v.join(",") : "";
				},
			},
			{ header: "ActiveTimeout", accessorKey: "activeTimeout", size: 140, meta: { align: "right" } },
			{ header: "Timeout", accessorKey: "timeout", size: 120, meta: { align: "right" } },
			{
				header: "Status",
				accessorKey: "status",
				size: 110,
				meta: { align: "center" },
				cell: ({ row }) => (Number(row.original.status) === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ header: "Created", accessorKey: "createTime", size: 180 },
			{ header: "Updated", accessorKey: "updateTime", size: 180 },
			{
				header: "操作",
				id: "actions",
				size: 200,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original;
					return (
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
								onClick={async () => {
									const ok = await confirm({
										title: "确认删除？",
										description: `客户端：${record.clientId}`,
										confirmText: "删除",
										destructive: true,
									});
									if (!ok) return;
									try {
										await deleteMutation.mutateAsync([Number(record.id)]);
										toast.success("删除成功", { position: "top-center" });
									} catch {
										// handled by apiClient
									}
								}}
							>
								删除
							</Button>
						</div>
					);
				},
			},
		],
		[can, confirm, deleteMutation, updateMutation.isPending],
	);

	return (
		<Card>
			<CardContent>
				<DataTable<SysClientRow>
					title="Client"
					actions={
						can("system:client:create") ? (
							<Button
								onClick={() => {
									setFormMode("create");
									setEditingId(null);
									setFormOpen(true);
								}}
							>
								新增
							</Button>
						) : null
					}
					search={
						<>
							<Input
								value={clientType}
								onChange={(e) => setClientType(e.target.value)}
								placeholder="ClientType"
								className="w-[160px]"
							/>
							<Input
								value={authType}
								onChange={(e) => setAuthType(e.target.value)}
								placeholder="AuthType（逗号分隔）"
								className="w-[220px]"
							/>
							<Select value={status} onValueChange={setStatus}>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="状态" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部</SelectItem>
									<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
									<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
								</SelectContent>
							</Select>
							<Button
								onClick={() => {
									const auth = authType
										.split(",")
										.map((x) => x.trim())
										.filter(Boolean);
									const s = status === "all" ? undefined : Number(status);
									setPage(1);
									setQuery({
										clientType: clientType.trim() || undefined,
										authType: auth.length ? auth : undefined,
										status: s !== undefined && Number.isFinite(s) ? s : undefined,
									});
								}}
							>
								查询
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									setClientType("");
									setAuthType("");
									setStatus("all");
									setPage(1);
									setQuery({});
								}}
							>
								重置
							</Button>
							<Button
								variant="secondary"
								onClick={() => queryClient.invalidateQueries({ queryKey: ["systemClient.page"] })}
							>
								刷新
							</Button>
						</>
					}
					columns={columns}
					data={data?.list || []}
					loading={isFetching}
					getRowId={(row) => String(row.id)}
					pagination={{
						page,
						pageSize,
						total: data?.total || 0,
						onChange: (p, s) => {
							setPage(p);
							setPageSize(s);
						},
						pageSizeOptions: [10, 20, 30, 50, 100],
					}}
				/>
				<ClientFormDialog
					open={formOpen}
					mode={formMode}
					id={editingId}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setFormOpen}
					onSubmit={onSubmit}
				/>
				{ConfirmDialog}
			</CardContent>
		</Card>
	);
}
