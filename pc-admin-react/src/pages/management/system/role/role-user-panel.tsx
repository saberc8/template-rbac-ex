// 角色-用户管理：展示 /system/role/:id/user，支持取消分配与打开分配弹窗

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { type RoleUserRow, systemRoleService } from "@/api/services/systemRoleService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import RoleAssignUserDialog from "./role-assign-user-dialog";

export default function RoleUserPanel({ roleId }: { roleId: number }) {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [assignOpen, setAssignOpen] = useState(false);
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemRole.roleUsers", roleId, page, pageSize, queryKeyword],
		queryFn: () =>
			systemRoleService.pageRoleUsers(roleId, { page, size: pageSize, description: queryKeyword || undefined }),
		enabled: roleId > 0,
	});

	const { data: assignedUserIds } = useQuery({
		queryKey: ["systemRole.roleUserIds", roleId],
		queryFn: () => systemRoleService.listRoleUserIds(roleId),
		enabled: assignOpen && roleId > 0,
	});
	const assignedUserIdSet = useMemo(
		() => new Set((assignedUserIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)),
		[assignedUserIds],
	);

	const unassignMutation = useMutation({
		mutationFn: (userRoleIds: number[]) => systemRoleService.unassignUsers(userRoleIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUsers", roleId] });
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUserIds", roleId] });
		},
	});

	const columns: Array<ColumnDef<RoleUserRow>> = useMemo(
		() => [
			{ header: "用户名", accessorKey: "username", size: 160 },
			{ header: "昵称", accessorKey: "nickname", size: 160 },
			{ header: "部门", accessorKey: "deptName", size: 180 },
			{
				header: "状态",
				accessorKey: "status",
				size: 90,
				meta: { align: "center" },
				cell: ({ row }) => (Number(row.original.status) === 2 ? "禁用" : "启用"),
			},
			{
				header: "操作",
				id: "actions",
				size: 160,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original;
					return (
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:role:unassign") || record.disabled || unassignMutation.isPending}
							onClick={async () => {
								const ok = await confirm({
									title: "确认取消分配？",
									description: `用户：${record.username}`,
									confirmText: "确认",
									destructive: true,
								});
								if (!ok) return;
								try {
									await unassignMutation.mutateAsync([Number(record.id)]);
									toast.success("取消分配成功", { position: "top-center" });
								} catch {
									// handled by apiClient
								}
							}}
						>
							取消分配
						</Button>
					);
				},
			},
		],
		[can, confirm, unassignMutation],
	);

	return (
		<div className="flex flex-col gap-3">
			<DataTable<RoleUserRow>
				actions={
					<Button disabled={!can("system:role:assign") || roleId <= 0} onClick={() => setAssignOpen(true)}>
						分配用户
					</Button>
				}
				search={
					<>
						<Input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder="用户名/昵称/描述"
							className="w-[260px]"
						/>
						<Button
							variant="secondary"
							onClick={() => {
								setPage(1);
								setQueryKeyword(keyword.trim());
							}}
						>
							查询
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								setKeyword("");
								setPage(1);
								setQueryKeyword("");
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

			<RoleAssignUserDialog
				open={assignOpen}
				roleId={roleId}
				assignedUserIdSet={assignedUserIdSet}
				onOpenChange={setAssignOpen}
				onSuccess={() => {
					queryClient.invalidateQueries({ queryKey: ["systemRole.roleUsers", roleId] });
				}}
			/>
			{ConfirmDialog}
		</div>
	);
}
