// 角色-用户管理：展示 /system/role/:id/user，支持取消分配与打开分配弹窗

import { systemRoleService, type RoleUserRow } from "@/api/services/systemRoleService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
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

	const { data, isFetching } = useQuery({
		queryKey: ["systemRole.roleUsers", roleId, page, pageSize, queryKeyword],
		queryFn: () => systemRoleService.pageRoleUsers(roleId, { page, size: pageSize, description: queryKeyword || undefined }),
		enabled: roleId > 0,
	});

	const { data: assignedUserIds } = useQuery({
		queryKey: ["systemRole.roleUserIds", roleId],
		queryFn: () => systemRoleService.listRoleUserIds(roleId),
		enabled: assignOpen && roleId > 0,
	});
	const assignedUserIdSet = useMemo(() => new Set((assignedUserIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)), [assignedUserIds]);

	const unassignMutation = useMutation({
		mutationFn: (userRoleIds: number[]) => systemRoleService.unassignUsers(userRoleIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUsers", roleId] });
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUserIds", roleId] });
		},
	});

	const columns: ColumnsType<RoleUserRow> = useMemo(
		() => [
			{ title: "用户名", dataIndex: "username", width: 160 },
			{ title: "昵称", dataIndex: "nickname", width: 160 },
			{ title: "部门", dataIndex: "deptName", width: 180, ellipsis: true },
			{ title: "状态", dataIndex: "status", width: 90, render: (v: number) => (Number(v) === 2 ? "禁用" : "启用") },
			{
				title: "操作",
				key: "actions",
				width: 140,
				fixed: "right",
				render: (_: any, record: RoleUserRow) => (
					<Button
						size="sm"
						variant="destructive"
						disabled={!can("system:role:unassign") || record.disabled || unassignMutation.isPending}
						onClick={() => {
							Modal.confirm({
								title: "确认取消分配？",
								content: `用户：${record.username}`,
								okText: "确认",
								cancelText: "取消",
								okButtonProps: { danger: true },
								onOk: async () => {
									try {
										await unassignMutation.mutateAsync([Number(record.id)]);
										toast.success("取消分配成功", { position: "top-center" });
									} catch {
										// handled by apiClient
									}
								},
							});
						}}
					>
						取消分配
					</Button>
				),
			},
		],
		[can, unassignMutation],
	);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="用户名/昵称/描述" className="w-[260px]" />
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
				</div>
				<Button disabled={!can("system:role:assign") || roleId <= 0} onClick={() => setAssignOpen(true)}>
					分配用户
				</Button>
			</div>

			<Table<RoleUserRow>
				rowKey="id"
				size="small"
				scroll={{ x: 900 }}
				loading={isFetching}
				columns={columns}
				dataSource={data?.list || []}
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
		</div>
	);
}

