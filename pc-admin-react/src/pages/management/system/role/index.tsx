import { systemDeptService, type SysDeptNode } from "@/api/services/systemDeptService";
import { systemRoleService, type SysRole, type SysRoleDetail, type SysRoleSaveReq } from "@/api/services/systemRoleService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import RoleFormDialog from "./role-form-dialog";
import RolePermissionPanel from "./role-permission-panel";
import RoleUserPanel from "./role-user-panel";

export default function RolePage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<"permission" | "users">("permission");

	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "update">("create");

	const { data, isFetching } = useQuery({
		queryKey: ["systemRole.list", queryKeyword],
		queryFn: () => systemRoleService.list(queryKeyword || undefined),
	});

	const { data: deptTree } = useQuery({
		queryKey: ["systemDept.tree"],
		queryFn: () => systemDeptService.tree(),
	});

	const { data: roleDetail } = useQuery({
		queryKey: ["systemRole.get", selectedRoleId],
		queryFn: () => systemRoleService.get(Number(selectedRoleId)),
		enabled: Boolean(selectedRoleId && selectedRoleId > 0),
	});

	useEffect(() => {
		const list = data || [];
		if (!list.length) {
			setSelectedRoleId(null);
			return;
		}
		if (selectedRoleId == null) {
			setSelectedRoleId(Number(list[0].id));
			return;
		}
		if (!list.some((r) => Number(r.id) === Number(selectedRoleId))) {
			setSelectedRoleId(Number(list[0].id));
		}
	}, [data, selectedRoleId]);

	const createMutation = useMutation({
		mutationFn: (payload: SysRoleSaveReq) => systemRoleService.create(payload),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.list"] });
			if (res?.id) setSelectedRoleId(Number(res.id));
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysRoleSaveReq }) => systemRoleService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.list"] });
			if (selectedRoleId) queryClient.invalidateQueries({ queryKey: ["systemRole.get", selectedRoleId] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemRoleService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.list"] });
		},
	});

	const onSubmitRole = async (payload: SysRoleSaveReq) => {
		try {
			if (formMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (formMode === "update" && roleDetail) {
				await updateMutation.mutateAsync({ id: Number(roleDetail.id), payload: { ...payload, code: roleDetail.code } });
				toast.success("保存成功", { position: "top-center" });
			}
			setFormOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	const columns: ColumnsType<SysRole> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 240 },
			{ title: "Code", dataIndex: "code", width: 200 },
			{ title: "Order", dataIndex: "sort", width: 80 },
			{
				title: "System",
				dataIndex: "isSystem",
				width: 100,
				render: (v: boolean) => (v ? "Yes" : "No"),
			},
			{ title: "Desc", dataIndex: "description" },
			{
				title: "操作",
				key: "actions",
				width: 160,
				fixed: "right",
				render: (_: any, record: SysRole) => (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:role:update") || record.disabled}
							onClick={() => {
								setSelectedRoleId(Number(record.id));
								setFormMode("update");
								setFormOpen(true);
							}}
						>
							编辑
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:role:delete") || record.disabled}
							onClick={() => {
								Modal.confirm({
									title: "确认删除？",
									content: `角色：${record.name}`,
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
		[can, deleteMutation],
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
				<Card className="min-w-0">
					<CardHeader>
						<div className="flex flex-col gap-3">
							<div className="flex items-center justify-between gap-3">
								<div>角色列表</div>
								{can("system:role:create") && (
									<Button
										onClick={() => {
											setFormMode("create");
											setFormOpen(true);
										}}
									>
										新增
									</Button>
								)}
							</div>
							<div className="flex items-center gap-2">
								<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="名称/描述" className="w-[240px]" />
								<Button onClick={() => setQueryKeyword(keyword.trim())}>查询</Button>
								<Button
									variant="secondary"
									onClick={() => {
										setKeyword("");
										setQueryKeyword("");
									}}
								>
									重置
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<Table<SysRole>
							rowKey="id"
							size="small"
							scroll={{ x: 760, y: 520 }}
							pagination={false}
							loading={isFetching}
							columns={columns}
							dataSource={data || []}
							rowSelection={{
								type: "radio",
								selectedRowKeys: selectedRoleId ? [selectedRoleId] : [],
								onChange: (keys) => setSelectedRoleId(Number(keys?.[0]) || null),
							}}
							onRow={(record) => ({
								onClick: () => setSelectedRoleId(Number(record.id)),
							})}
						/>
					</CardContent>
				</Card>

				<Card className="min-w-0">
					<CardHeader>
						<div className="flex items-center justify-between gap-3">
							<div>角色详情</div>
							<div className="text-sm text-muted-foreground">{selectedRoleId ? `ID: ${selectedRoleId}` : "未选择角色"}</div>
						</div>
					</CardHeader>
					<CardContent>
						{selectedRoleId ? (
							<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
								<TabsList>
									<TabsTrigger value="permission">功能权限</TabsTrigger>
									<TabsTrigger value="users">角色用户</TabsTrigger>
								</TabsList>
								<TabsContent value="permission">
									<RolePermissionPanel roleId={selectedRoleId} canSave={can("system:role:updatePermission")} />
								</TabsContent>
								<TabsContent value="users">
									<RoleUserPanel roleId={selectedRoleId} />
								</TabsContent>
							</Tabs>
						) : (
							<div className="text-sm text-muted-foreground">请先从左侧选择一个角色。</div>
						)}
					</CardContent>
				</Card>
			</div>

			<RoleFormDialog
				open={formOpen}
				mode={formMode}
				deptTree={deptTree || ([] as SysDeptNode[])}
				initial={formMode === "update" ? (roleDetail as SysRoleDetail) : null}
				busy={createMutation.isPending || updateMutation.isPending}
				onOpenChange={setFormOpen}
				onSubmit={onSubmitRole}
			/>
		</div>
	);
}
