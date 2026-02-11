// 角色-分配用户弹窗：从 /system/user 分页选择用户，提交到 /system/role/:id/user

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { systemRoleService } from "@/api/services/systemRoleService";
import { type SysUserRow, systemUserService } from "@/api/services/systemUserService";
import DataTable from "@/components/data-table/data-table";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";

export default function RoleAssignUserDialog({
	open,
	roleId,
	assignedUserIdSet,
	onOpenChange,
	onSuccess,
}: {
	open: boolean;
	roleId: number;
	assignedUserIdSet: Set<number>;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}) {
	const queryClient = useQueryClient();

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

	const { data, isFetching } = useQuery({
		queryKey: ["systemUser.page", page, pageSize, queryKeyword],
		queryFn: () =>
			systemUserService.page({
				page,
				size: pageSize,
				description: queryKeyword || undefined,
			}),
		enabled: open,
	});

	const mutation = useMutation({
		mutationFn: (userIds: number[]) => systemRoleService.assignUsers(roleId, userIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUsers", roleId] });
			queryClient.invalidateQueries({ queryKey: ["systemRole.roleUserIds", roleId] });
		},
	});

	const columns: Array<ColumnDef<SysUserRow>> = useMemo(
		() => [
			{ header: "用户名", accessorKey: "username", size: 160 },
			{ header: "昵称", accessorKey: "nickname", size: 160 },
			{ header: "部门", accessorKey: "deptName", size: 180 },
			{
				header: "角色",
				accessorKey: "roleNames",
				size: 260,
				cell: ({ row }) => {
					const v = row.original.roleNames;
					return v?.length ? v.join(", ") : "-";
				},
			},
		],
		[],
	);

	const onSubmit = async () => {
		const ids = (selectedUserIds || []).filter((id) => !assignedUserIdSet.has(id));
		if (!ids.length) {
			toast.error("请选择要分配的用户", { position: "top-center" });
			return;
		}
		try {
			await mutation.mutateAsync(ids);
			toast.success("分配成功", { position: "top-center" });
			setSelectedUserIds([]);
			onSuccess();
			onOpenChange(false);
		} catch {
			// handled by apiClient
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (!v) setSelectedUserIds([]);
			}}
		>
			<DialogContent className="max-w-[980px]">
				<DialogHeader>
					<DialogTitle>分配用户</DialogTitle>
				</DialogHeader>

				<div className="flex flex-wrap items-center gap-2">
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
				</div>

				<DataTable<SysUserRow>
					columns={columns}
					data={data?.list || []}
					loading={isFetching}
					getRowId={(row) => String(row.id)}
					selection={{
						selectedRowIds: selectedUserIds,
						onSelectedRowIdsChange: (ids) =>
							setSelectedUserIds(ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)),
						isRowSelectable: (record) => !assignedUserIdSet.has(Number(record.id)),
					}}
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

				<DialogFooter>
					<Button variant="secondary" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={mutation.isPending} onClick={onSubmit}>
						确认分配
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
