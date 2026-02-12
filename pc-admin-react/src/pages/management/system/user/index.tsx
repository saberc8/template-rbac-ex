import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import { type SysDeptNode, systemDeptService } from "@/api/services/systemDeptService";
import { type SysUserRow, systemUserService } from "@/api/services/systemUserService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import OperationActions from "@/components/data-table/operation-actions";
import { usePathname, useRouter } from "@/routes/hooks";
import { useUserPermissions } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import SystemSideCard from "../components/system-side-card";
import SystemSideList from "../components/system-side-list";
import UserFormSheet from "./user-form-sheet";
import UserImportSheet from "./user-import-sheet";
import UserResetPasswordDialog from "./user-reset-password-dialog";
import UserUpdateRoleDialog from "./user-update-role-dialog";

export default function UserPage() {
	const { push } = useRouter();
	const pathname = usePathname();

	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);
	const canAny = useCallback((codes: string[]) => codes.some((c) => permissionCodeSet.has(c)), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [deptId, setDeptId] = useState<number | undefined>(undefined);

	const [queryKeyword, setQueryKeyword] = useState("");
	const [queryStatus, setQueryStatus] = useState<number | undefined>(undefined);
	const [queryDeptId, setQueryDeptId] = useState<number | undefined>(undefined);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);

	const { data: deptTree, isFetching: isDeptFetching } = useQuery({
		queryKey: ["systemDept.tree"],
		queryFn: () => systemDeptService.tree(),
	});

	useEffect(() => {
		if (!deptTree?.length) return;
		if (deptId !== undefined || queryDeptId !== undefined) return;

		const defaultDeptId = Number((deptTree || []).find((n) => Number(n.id) === 1)?.id) || Number(deptTree[0]?.id) || 0;
		if (defaultDeptId <= 0) return;

		setDeptId(defaultDeptId);
		setQueryDeptId(defaultDeptId);
		setPage(1);
	}, [deptId, deptTree, queryDeptId]);

	const { data, isFetching } = useQuery({
		queryKey: ["systemUser.page", page, pageSize, queryKeyword, queryStatus, queryDeptId],
		queryFn: () =>
			systemUserService.page({
				page,
				size: pageSize,
				description: queryKeyword || undefined,
				status: queryStatus,
				deptId: queryDeptId,
			}),
	});

	const [userFormOpen, setUserFormOpen] = useState(false);
	const [userFormMode, setUserFormMode] = useState<"create" | "update">("create");
	const [editingUserId, setEditingUserId] = useState<number | null>(null);

	const [importOpen, setImportOpen] = useState(false);
	const [resetPwdOpen, setResetPwdOpen] = useState(false);
	const [updateRoleOpen, setUpdateRoleOpen] = useState(false);
	const [activeUserId, setActiveUserId] = useState<number | null>(null);
	const [activeUserRoleIds, setActiveUserRoleIds] = useState<number[] | undefined>(undefined);
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemUserService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemUser.page"] });
		},
	});
	const exportMutation = useMutation({
		mutationFn: () => systemUserService.exportCsv(),
	});

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	const refresh = () => queryClient.invalidateQueries({ queryKey: ["systemUser.page"] });

	const columns: Array<ColumnDef<SysUserRow>> = useMemo(() => {
		const base: Array<ColumnDef<SysUserRow>> = [
			{
				header: "用户",
				id: "user",
				size: 260,
				cell: ({ row }) => {
					const record = row.original;
					return (
						<div className="flex">
							<img alt="" src={record.avatar} className="h-10 w-10 rounded-full object-cover bg-muted" />
							<div className="ml-2 flex flex-col">
								<span className="text-sm">{record.nickname || "-"}</span>
								<span className="text-xs text-text-secondary">{record.username}</span>
							</div>
						</div>
					);
				},
			},
			{ header: "部门", accessorKey: "deptName", size: 180 },
			{
				header: "角色",
				accessorKey: "roleNames",
				size: 240,
				meta: { align: "center" },
				cell: ({ row }) => <Badge variant="info">{(row.original.roleNames || []).join(", ") || "-"}</Badge>,
			},
			{
				header: "状态",
				accessorKey: "status",
				size: 120,
				meta: { align: "center" },
				cell: ({ row }) => {
					const status = Number(row.original.status);
					return (
						<Badge variant={status === BasicStatus.DISABLE ? "error" : "success"}>
							{status === BasicStatus.DISABLE ? "禁用" : "启用"}
						</Badge>
					);
				},
			},
			{
				header: "手机",
				accessorKey: "phone",
				size: 150,
				cell: ({ row }) => row.original.phone || "-",
			},
			{
				header: "邮箱",
				accessorKey: "email",
				size: 200,
				cell: ({ row }) => row.original.email || "-",
			},
			{ header: "创建时间", accessorKey: "createTime", size: 180, cell: ({ row }) => row.original.createTime || "-" },
		];

		if (
			!canAny([
				"system:user:get",
				"system:user:update",
				"system:user:delete",
				"system:user:resetPwd",
				"system:user:updateRole",
			])
		) {
			return base;
		}

		base.push({
			header: "操作",
			id: "operation",
			size: 260,
			meta: { align: "center" },
			cell: ({ row }) => {
				const record = row.original;
				return (
					<OperationActions
						items={[
							{
								key: "detail",
								label: "详情",
								hidden: !can("system:user:get"),
								onClick: () => {
									push(`${pathname}/${record.id}`);
								},
							},
							{
								key: "update",
								label: "修改",
								hidden: !can("system:user:update"),
								onClick: () => {
									setUserFormMode("update");
									setEditingUserId(record.id);
									setUserFormOpen(true);
								},
							},
							{
								key: "delete",
								label: "删除",
								variant: "destructive",
								hidden: !can("system:user:delete"),
								disabled: Boolean(record.isSystem) || deleteMutation.isPending,
								title: record.isSystem ? "系统内置数据不能删除" : undefined,
								onClick: async () => {
									if (record.isSystem) return;
									const ok = await confirm({
										title: "确认删除？",
										description: `用户：${record.nickname}（${record.username}）`,
										confirmText: "删除",
										destructive: true,
									});
									if (!ok) return;
									try {
										await deleteMutation.mutateAsync([record.id]);
										toast.success("删除成功", { position: "top-center" });
									} catch {
										// handled by apiClient
									}
								},
							},
							{
								key: "resetPwd",
								label: "重置密码",
								hidden: !can("system:user:resetPwd"),
								onClick: () => {
									setActiveUserId(record.id);
									setResetPwdOpen(true);
								},
							},
							{
								key: "updateRole",
								label: "分配角色",
								hidden: !can("system:user:updateRole"),
								onClick: () => {
									setActiveUserId(record.id);
									setActiveUserRoleIds(record.roleIds);
									setUpdateRoleOpen(true);
								},
							},
						]}
						maxVisible={3}
					/>
				);
			},
		});
		return base;
	}, [can, canAny, confirm, deleteMutation.isPending, deleteMutation.mutateAsync, pathname, push]);

	const deptItems = useMemo(() => {
		const out: Array<{ key: number; title: string; depth: number }> = [];
		const walk = (nodes: SysDeptNode[], depth: number) => {
			for (const n of nodes || []) {
				const id = Number(n.id);
				if (!Number.isFinite(id) || id <= 0) continue;
				out.push({ key: id, title: String(n.name || "-"), depth });
				if (n.children?.length) walk(n.children, depth + 1);
			}
		};
		walk(deptTree || [], 0);
		return out;
	}, [deptTree]);

	return (
		<div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
			<SystemSideCard
				title="部门"
				extra={undefined}
				contentClassName="pt-0"
			>
				{isDeptFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
				{!isDeptFetching && (
					<SystemSideList
						items={deptItems.map((it) => ({ key: it.key, title: it.title, depth: it.depth }))}
						selectedKey={deptId ?? null}
						onSelect={(k) => {
							const v = Number(k) || undefined;
							setDeptId(v);
							setPage(1);
							setQueryDeptId(v);
						}}
					/>
				)}
			</SystemSideCard>

			<Card className="min-w-0">
				<CardContent>
					<DataTable<SysUserRow>
						title="用户列表"
						actions={
							<div className="flex items-center gap-2">
								{can("system:user:create") && (
									<Button
										size="sm"
										onClick={() => {
											setUserFormMode("create");
											setEditingUserId(null);
											setUserFormOpen(true);
										}}
									>
										新增
									</Button>
								)}
								{can("system:user:import") && (
									<Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
										导入
									</Button>
								)}
								{can("system:user:export") && (
									<Button
										size="sm"
										variant="secondary"
										disabled={exportMutation.isPending}
										onClick={async () => {
											try {
												const blob = await exportMutation.mutateAsync();
												downloadBlob(blob, "users.csv");
											} catch {
												// handled by apiClient
											}
										}}
									>
										导出
									</Button>
								)}
							</div>
						}
						search={
							<>
								<Input
									value={keyword}
									onChange={(e) => setKeyword(e.target.value)}
									placeholder="用户名/昵称/描述"
									className="w-[240px]"
								/>
								<Select
									value={status === undefined ? "all" : String(status)}
									onValueChange={(v) => setStatus(v === "all" ? undefined : Number(v))}
								>
									<SelectTrigger size="sm" className="w-[140px]">
										<SelectValue placeholder="状态" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">全部状态</SelectItem>
										<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
										<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
									</SelectContent>
								</Select>
								<Button
									onClick={() => {
										setPage(1);
										setQueryKeyword(keyword.trim());
										setQueryStatus(status);
										setQueryDeptId(deptId);
									}}
								>
									查询
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										setKeyword("");
										setStatus(undefined);
										setDeptId(undefined);
										setPage(1);
										setQueryKeyword("");
										setQueryStatus(undefined);
										setQueryDeptId(undefined);
									}}
								>
									重置
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
				</CardContent>
			</Card>

			<UserFormSheet
				open={userFormOpen}
				mode={userFormMode}
				userId={editingUserId}
				onOpenChange={setUserFormOpen}
				onSuccess={refresh}
			/>
			<UserImportSheet open={importOpen} onOpenChange={setImportOpen} onSuccess={refresh} />
			<UserResetPasswordDialog open={resetPwdOpen} userId={activeUserId} onOpenChange={setResetPwdOpen} />
			<UserUpdateRoleDialog
				open={updateRoleOpen}
				userId={activeUserId}
				defaultRoleIds={activeUserRoleIds}
				onOpenChange={setUpdateRoleOpen}
				onSuccess={refresh}
			/>
			{ConfirmDialog}
		</div>
	);
}
