import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import { type SysStorageRow, type SysStorageSaveReq, systemStorageService } from "@/api/services/systemStorageService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Switch } from "@/ui/switch";
import StorageFormDialog from "./storage-form-dialog";

export default function StoragePage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [description, setDescription] = useState("");
	const [type, setType] = useState<"all" | "1" | "2">("all");
	const [query, setQuery] = useState<{ description?: string; type?: number }>({});
	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysStorageRow | null>(null);
	const { confirm, ConfirmDialog } = useConfirmDialog();

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
		mutationFn: ({ id, payload }: { id: number; payload: SysStorageSaveReq }) =>
			systemStorageService.update(id, payload),
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

	const columns: Array<ColumnDef<SysStorageRow>> = useMemo(
		() => [
			{ header: t("sys.page.systemStorage.columns.name"), accessorKey: "name", size: 160 },
			{ header: t("sys.page.systemStorage.columns.code"), accessorKey: "code", size: 120 },
			{
				header: t("sys.page.systemStorage.columns.type"),
				accessorKey: "type",
				size: 120,
				cell: ({ row }) => (Number(row.original.type) === 2 ? "OSS/MinIO" : "本地"),
			},
			{
				header: t("sys.page.systemStorage.columns.isDefault"),
				id: "isDefault",
				accessorFn: (row) => {
					const r: any = row as any;
					return r.isDefault ?? r.is_default ?? false;
				},
				size: 90,
				meta: { align: "center" },
				cell: ({ row }) => {
					const r: any = row.original as any;
					return r.isDefault ?? r.is_default ? "Yes" : "No";
				},
			},
			{
				header: t("sys.page.systemStorage.columns.status"),
				accessorKey: "status",
				size: 140,
				cell: ({ row }) => {
					const record = row.original;
					const isDefault = Boolean((record as any).isDefault ?? (record as any).is_default);
					return (
						<div className="flex items-center gap-2">
							<Switch
								checked={Number(record.status) === BasicStatus.ENABLE}
								disabled={!can("system:storage:updateStatus") || isDefault || statusMutation.isPending}
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
							<span className="text-xs text-muted-foreground">
								{Number(record.status) === BasicStatus.ENABLE ? t("sys.page.systemStorage.status.enable") : t("sys.page.systemStorage.status.disable")}
							</span>
						</div>
					);
				},
			},
			{ header: t("sys.page.systemStorage.columns.endpoint"), accessorKey: "endpoint", size: 220 },
			{
				header: t("sys.page.systemStorage.columns.bucketName"),
				id: "bucketName",
				accessorFn: (row) => (row as any).bucketName ?? (row as any).bucket_name ?? "",
				size: 140,
			},
			{
				header: t("sys.page.systemStorage.columns.domain"),
				id: "domain",
				accessorFn: (row) => (row as any).domain ?? "",
				size: 220,
			},
			{ header: t("sys.page.systemStorage.columns.description"), accessorKey: "description", size: 200 },
			{ header: t("sys.page.systemStorage.columns.updateTime"), accessorKey: "updateTime", size: 170 },
			{
				header: t("sys.page.systemStorage.columns.actions"),
				id: "actions",
				size: 180,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original;
					const isDefault = Boolean((record as any).isDefault ?? (record as any).is_default);
					return (
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
								disabled={!can("system:storage:setDefault") || isDefault || defaultMutation.isPending}
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
								disabled={!can("system:storage:delete") || isDefault || deleteMutation.isPending}
								onClick={async () => {
									const ok = await confirm({
										title: "确认删除？",
										description: isDefault ? "默认存储不允许删除" : `存储：${record.name}`,
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
		[
			can,
			confirm,
			defaultMutation.isPending,
			defaultMutation.mutateAsync,
			deleteMutation.isPending,
			deleteMutation.mutateAsync,
			statusMutation.isPending,
			statusMutation.mutateAsync,
			t,
			updateMutation.isPending,
		],
	);

	return (
		<Card>
			<CardContent>
				<DataTable<SysStorageRow>
					title={t("sys.page.systemStorage.title")}
					actions={
						can("system:storage:create") ? (
							<Button
								onClick={() => {
									setFormMode("create");
									setEditing(null);
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
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={t("sys.page.systemStorage.searchPlaceholder")}
								className="w-[220px]"
							/>
							<Select value={type} onValueChange={(v) => setType(v as any)}>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder={t("sys.page.systemStorage.typePlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("sys.page.systemStorage.type.all")}</SelectItem>
									<SelectItem value="1">{t("sys.page.systemStorage.type.local")}</SelectItem>
									<SelectItem value="2">{t("sys.page.systemStorage.type.oss")}</SelectItem>
								</SelectContent>
							</Select>
							<Button
								onClick={() => {
									const t = type === "all" ? NaN : Number(type);
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
									setType("all");
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
						</>
					}
					columns={columns}
					data={data || []}
					loading={isFetching}
					getRowId={(row) => String(row.id)}
				/>
				<StorageFormDialog
					open={formOpen}
					mode={formMode}
					initial={editing}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setFormOpen}
					onSubmit={onSubmit}
				/>
				{ConfirmDialog}
			</CardContent>
		</Card>
	);
}
