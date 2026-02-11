// 角色-分配用户弹窗：从 /system/user 分页选择用户，提交到 /system/role/:id/user

import { systemUserService, type SysUserRow } from "@/api/services/systemUserService";
import { systemRoleService } from "@/api/services/systemRoleService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

	const columns: ColumnsType<SysUserRow> = useMemo(
		() => [
			{ title: "用户名", dataIndex: "username", width: 160 },
			{ title: "昵称", dataIndex: "nickname", width: 160 },
			{ title: "部门", dataIndex: "deptName", width: 180, ellipsis: true },
			{ title: "角色", dataIndex: "roleNames", render: (v: string[]) => (v && v.length ? v.join(", ") : "-") },
		],
		[],
	);

	const rowSelection = useMemo(
		() => ({
			selectedRowKeys: selectedUserIds,
			onChange: (keys: React.Key[]) => setSelectedUserIds(keys.map((k) => Number(k)).filter((x) => Number.isFinite(x) && x > 0)),
			getCheckboxProps: (record: SysUserRow) => ({ disabled: assignedUserIdSet.has(Number(record.id)) }),
		}),
		[assignedUserIdSet, selectedUserIds],
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

				<Table<SysUserRow>
					rowKey="id"
					size="small"
					scroll={{ x: 900 }}
					loading={isFetching}
					columns={columns}
					dataSource={data?.list || []}
					rowSelection={rowSelection as any}
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

