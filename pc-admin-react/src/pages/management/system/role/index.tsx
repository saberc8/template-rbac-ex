import { systemDeptService, type SysDeptNode } from "@/api/services/systemDeptService";
import { systemRoleService, type SysRole, type SysRoleDetail, type SysRoleSaveReq } from "@/api/services/systemRoleService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Icon from "@/components/icon/icon";
import { Dropdown, Modal, Tree, Typography } from "antd";
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
	const canAny = useCallback((codes: string[]) => codes.some((c) => permissionCodeSet.has(c)), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<"permission" | "users">("permission");

	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "update">("create");
	const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

	const { data, isFetching } = useQuery({
		queryKey: ["systemRole.list"],
		queryFn: () => systemRoleService.list(),
	});

	const { data: deptTree } = useQuery({
		queryKey: ["systemDept.tree"],
		queryFn: () => systemDeptService.tree(),
	});

	const { data: editingRoleDetail, isFetching: isEditingRoleFetching } = useQuery({
		queryKey: ["systemRole.get", editingRoleId],
		queryFn: () => systemRoleService.get(Number(editingRoleId)),
		enabled: Boolean(formOpen && formMode === "update" && editingRoleId && editingRoleId > 0),
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
			if (editingRoleId) queryClient.invalidateQueries({ queryKey: ["systemRole.get", editingRoleId] });
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
			} else if (formMode === "update" && editingRoleDetail) {
				await updateMutation.mutateAsync({
					id: Number(editingRoleDetail.id),
					payload: { ...payload, code: editingRoleDetail.code },
				});
				toast.success("保存成功", { position: "top-center" });
			}
			setFormOpen(false);
			setEditingRoleId(null);
		} catch {
			// handled by apiClient
		}
	};

	const filteredRoles = useMemo(() => {
		const list = data || [];
		const q = (queryKeyword || "").trim().toLowerCase();
		if (!q) return list;
		return list.filter((r) => {
			const name = String(r.name || "").toLowerCase();
			const code = String(r.code || "").toLowerCase();
			return name.includes(q) || code.includes(q);
		});
	}, [data, queryKeyword]);

	const openCreate = () => {
		setFormMode("create");
		setEditingRoleId(null);
		setFormOpen(true);
	};

	const openEdit = async (role: SysRole) => {
		const roleId = Number(role.id);
		if (!Number.isFinite(roleId) || roleId <= 0) return;
		setFormMode("update");
		setEditingRoleId(roleId);
		setSelectedRoleId(roleId);
		setFormOpen(true);
		try {
			await queryClient.fetchQuery({
				queryKey: ["systemRole.get", roleId],
				queryFn: () => systemRoleService.get(roleId),
			});
		} catch {
			// handled by apiClient
		}
	};

	const confirmDelete = (role: SysRole) => {
		Modal.confirm({
			title: "确认删除？",
			content: `角色：${role.name}`,
			okText: "删除",
			cancelText: "取消",
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await deleteMutation.mutateAsync([Number(role.id)]);
					toast.success("删除成功", { position: "top-center" });
				} catch {
					// handled by apiClient
				}
			},
		});
	};

	const treeData = useMemo(() => {
		const canShowAction = canAny(["system:role:update", "system:role:delete"]);
		return (filteredRoles || []).map((r) => {
			const roleId = Number(r.id);
			const canUpdate = can("system:role:update") && !r.disabled;
			const canDelete = can("system:role:delete") && !r.disabled;
			const items = [
				canShowAction
					? {
							key: "update",
							label: "编辑",
							disabled: !canUpdate,
						}
					: null,
				canShowAction
					? {
							key: "delete",
							label: "删除",
							disabled: !canDelete,
						}
					: null,
			].filter(Boolean) as any[];

			return {
				key: roleId,
				title: (
					<div className="group flex w-full min-w-0 items-center justify-between gap-2">
						<Typography.Text
							className="min-w-0"
							ellipsis={{ tooltip: `${r.name || ""} (${r.code || ""})` }}
						>
							{r.name} ({r.code})
						</Typography.Text>

						{canShowAction && (
							<Dropdown
								trigger={["click"]}
								menu={{
									items,
									onClick: ({ key }) => {
										if (key === "update") openEdit(r);
										if (key === "delete") confirmDelete(r);
									},
								}}
							>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="opacity-0 transition-opacity group-hover:opacity-100"
									onClick={(e) => e.stopPropagation()}
								>
									<Icon icon="mdi:dots-horizontal" />
								</Button>
							</Dropdown>
						)}
					</div>
				),
				isLeaf: true,
			};
		});
	}, [can, canAny, confirmDelete, filteredRoles, openEdit]);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
				<Card className="min-w-0">
					<CardHeader>
						<div className="flex flex-col gap-3">
							<div className="flex items-center justify-between gap-3">
								<div>角色列表</div>
								{can("system:role:create") && (
									<Button onClick={openCreate}>新增</Button>
								)}
							</div>
							<div className="flex items-center gap-2">
								<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索名称/编码" className="w-[240px]" />
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
						{isFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
						{!isFetching && (
							<div className="max-h-[520px] overflow-auto">
								{!treeData.length && <div className="text-sm text-muted-foreground">暂无数据</div>}
								{Boolean(treeData.length) && (
									<Tree
										blockNode
										showLine={false}
										treeData={treeData as any}
										selectedKeys={selectedRoleId ? [selectedRoleId] : []}
										onSelect={(keys: any[]) => {
											const v = Number(keys?.[0]) || null;
											if (v && selectedRoleId && Number(selectedRoleId) === Number(v)) return;
											setSelectedRoleId(v);
										}}
									/>
								)}
							</div>
						)}
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
				initial={formMode === "update" ? (editingRoleDetail as SysRoleDetail) : null}
				busy={createMutation.isPending || updateMutation.isPending || isEditingRoleFetching}
				onOpenChange={(open) => {
					setFormOpen(open);
					if (!open) setEditingRoleId(null);
				}}
				onSubmit={onSubmitRole}
			/>
		</div>
	);
}
