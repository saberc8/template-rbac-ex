import { Icon } from "@/components/icon";
import { systemDeptService, type SysDeptNode } from "@/api/services/systemDeptService";
import { systemUserService, type SysUserRow } from "@/api/services/systemUserService";
import { usePathname, useRouter } from "@/routes/hooks";
import { useUserPermissions } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, Tree } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BasicStatus } from "#/enum";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import UserFormSheet from "./user-form-sheet";
import UserImportSheet from "./user-import-sheet";
import UserResetPasswordDialog from "./user-reset-password-dialog";
import UserUpdateRoleDialog from "./user-update-role-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";

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

	const columns: ColumnsType<SysUserRow> = useMemo(() => {
		const base: ColumnsType<SysUserRow> = [
			{
				title: "用户",
				dataIndex: "nickname",
				width: 240,
				render: (_, record) => (
					<div className="flex">
						<img alt="" src={record.avatar} className="h-10 w-10 rounded-full object-cover bg-muted" />
						<div className="ml-2 flex flex-col">
							<span className="text-sm">{record.nickname || "-"}</span>
							<span className="text-xs text-text-secondary">{record.username}</span>
						</div>
					</div>
				),
			},
			{ title: "部门", dataIndex: "deptName", width: 180, ellipsis: true },
			{
				title: "角色",
				dataIndex: "roleNames",
				align: "center",
				width: 220,
				render: (roleNames: string[]) => <Badge variant="info">{(roleNames || []).join(", ") || "-"}</Badge>,
			},
			{
				title: "状态",
				dataIndex: "status",
				align: "center",
				width: 120,
				render: (status: number) => (
					<Badge variant={status === BasicStatus.DISABLE ? "error" : "success"}>{status === BasicStatus.DISABLE ? "禁用" : "启用"}</Badge>
				),
			},
			{ title: "手机", dataIndex: "phone", width: 150, ellipsis: true, render: (v?: string) => v || "-" },
			{ title: "邮箱", dataIndex: "email", width: 180, ellipsis: true, render: (v?: string) => v || "-" },
			{ title: "创建时间", dataIndex: "createTime", width: 180, render: (v?: string) => v || "-" },
		];

		if (!canAny(["system:user:get", "system:user:update", "system:user:delete", "system:user:resetPwd", "system:user:updateRole"])) {
			return base;
		}

		base.push({
			title: "操作",
			key: "operation",
			align: "center",
			width: 220,
			fixed: "right",
			render: (_, record) => (
				<div className="flex w-full items-center justify-center gap-1 text-gray-500">
					{can("system:user:get") && (
						<Button
							variant="ghost"
							size="icon"
							title="详情"
							onClick={() => {
								push(`${pathname}/${record.id}`);
							}}
						>
							<Icon icon="mdi:card-account-details" size={18} />
						</Button>
					)}
					{can("system:user:update") && (
						<Button
							variant="ghost"
							size="icon"
							title="修改"
							onClick={() => {
								setUserFormMode("update");
								setEditingUserId(record.id);
								setUserFormOpen(true);
							}}
						>
							<Icon icon="mdi:pencil" size={18} />
						</Button>
					)}
					{can("system:user:delete") && (
						<Button
							variant="ghost"
							size="icon"
							title={record.isSystem ? "系统内置数据不能删除" : "删除"}
							disabled={Boolean(record.isSystem) || deleteMutation.isPending}
							onClick={async () => {
								if (record.isSystem) return;
								const ok = window.confirm(`是否确定删除用户「${record.nickname}(${record.username})」？`);
								if (!ok) return;
								try {
									await deleteMutation.mutateAsync([record.id]);
									toast.success("删除成功", { position: "top-center" });
								} catch {
									// handled by apiClient
								}
							}}
						>
							<Icon icon="mdi:delete-outline" size={18} />
						</Button>
					)}
					{canAny(["system:user:resetPwd", "system:user:updateRole"]) && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									title="更多"
									onClick={() => {
										setActiveUserId(record.id);
										setActiveUserRoleIds(record.roleIds);
									}}
								>
									<Icon icon="dashicons:ellipsis" size={18} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{can("system:user:resetPwd") && (
									<DropdownMenuItem
										onClick={() => {
											setActiveUserId(record.id);
											setResetPwdOpen(true);
										}}
									>
										重置密码
									</DropdownMenuItem>
								)}
								{can("system:user:updateRole") && (
									<DropdownMenuItem
										onClick={() => {
											setActiveUserId(record.id);
											setActiveUserRoleIds(record.roleIds);
											setUpdateRoleOpen(true);
										}}
									>
										分配角色
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			),
		});
		return base;
	}, [can, canAny, deleteMutation.isPending, pathname, push]);

	const deptTreeData = useMemo(() => {
		const toNodes = (nodes: SysDeptNode[]): any[] =>
			(nodes || []).map((n) => ({
				title: n.name,
				key: n.id,
				children: toNodes(n.children || []),
			}));
		return toNodes(deptTree || []);
	}, [deptTree]);

	return (
		<div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-2">
						<div>部门</div>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => {
								setDeptId(undefined);
								setQueryDeptId(undefined);
								setPage(1);
							}}
						>
							清空
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{isDeptFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
					{!isDeptFetching && (
						<div className="text-sm">
							<Tree
								treeData={deptTreeData}
								selectedKeys={deptId ? [deptId] : []}
								onSelect={(keys: any[]) => {
									const v = Number(keys?.[0]) || undefined;
									setDeptId(v);
									setPage(1);
									setQueryDeptId(v);
								}}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="min-w-0">
				<CardHeader>
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-3">
							<div>用户列表</div>
							<div className="flex items-center gap-2">
								{can("system:user:create") && (
									<Button
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
									<Button variant="secondary" onClick={() => setImportOpen(true)}>
										导入
									</Button>
								)}
								{can("system:user:export") && (
									<Button
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
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="用户名/昵称/描述" className="w-[240px]" />
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
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="min-w-0 overflow-x-auto">
						<Table<SysUserRow>
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
							columns={columns as any}
							dataSource={data?.list || []}
						/>
					</div>
				</CardContent>
			</Card>

			<UserFormSheet
				open={userFormOpen}
				mode={userFormMode}
				userId={editingUserId}
				onOpenChange={setUserFormOpen}
				onSuccess={refresh}
			/>
			<UserImportSheet
				open={importOpen}
				onOpenChange={setImportOpen}
				onSuccess={refresh}
			/>
			<UserResetPasswordDialog open={resetPwdOpen} userId={activeUserId} onOpenChange={setResetPwdOpen} />
			<UserUpdateRoleDialog open={updateRoleOpen} userId={activeUserId} defaultRoleIds={activeUserRoleIds} onOpenChange={setUpdateRoleOpen} onSuccess={refresh} />
		</div>
	);
}
