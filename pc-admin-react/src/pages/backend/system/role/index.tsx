// 后端路由页面：系统管理-角色管理（对齐 pc-admin-vue3：左侧角色树 + 功能权限/角色用户 两个标签页）。

import systemDeptService from "@/api/services/systemDeptService";
import systemMenuService from "@/api/services/systemMenuService";
import systemRoleService from "@/api/services/systemRoleService";
import systemUserService from "@/api/services/systemUserService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Drawer, Form, Modal, Select, Tabs, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { DeptResp, MenuResp, RoleDetailResp, RoleResp, RoleSaveReq, RoleUserResp } from "#/system";

const treeToNodes = (list: { id: number; title?: string; name?: string; code?: string; children?: any[] }[]): DataNode[] =>
	list.map((n) => ({
		key: n.id,
		title: n.title ?? (n.code ? `${n.name} (${n.code})` : n.name),
		children: n.children?.length ? treeToNodes(n.children) : undefined,
	}));

const flattenMenuIds = (list: MenuResp[]): number[] => {
	const out: number[] = [];
	const walk = (arr: MenuResp[]) => {
		for (const n of arr) {
			out.push(n.id);
			if (n.children?.length) walk(n.children);
		}
	};
	walk(list);
	return out;
};

function RoleTree({
	onSelectRole,
	selectedRoleId,
}: {
	onSelectRole: (roleId: number) => void;
	selectedRoleId?: number;
}) {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:role:create"]);
	const canUpdate = checkAny(["system:role:update"]);
	const canDelete = checkAny(["system:role:delete"]);

	const [searchKey, setSearchKey] = useState("");
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editing, setEditing] = useState<RoleDetailResp | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<RoleSaveReq>();
	const [deptCheckedKeys, setDeptCheckedKeys] = useState<number[]>([]);

	const deptQuery = useQuery({
		queryKey: ["system.dept.tree"],
		queryFn: () => systemDeptService.listDeptTree(),
	});

	const roleQuery = useQuery({
		queryKey: ["system.role.list", searchKey],
		queryFn: () => systemRoleService.listRole({ description: searchKey || undefined }),
	});

	const roles = roleQuery.data || [];

	useEffect(() => {
		if (!selectedRoleId && roles.length) {
			onSelectRole(roles[0].id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [roles]);

	const roleNodes = useMemo(
		() => roles.map((r) => ({ key: r.id, title: `${r.name} (${r.code})` })),
		[roles],
	);

	const openAdd = async () => {
		setEditing(null);
		form.resetFields();
		form.setFieldsValue({
			name: "",
			code: "",
			sort: 999,
			description: "",
			dataScope: 4,
			deptIds: [],
			deptCheckStrictly: true,
		});
		setDeptCheckedKeys([]);
		setDrawerOpen(true);
	};

	const openEdit = async (roleId: number) => {
		const detail = await systemRoleService.getRole(roleId);
		setEditing(detail);
		form.resetFields();
		form.setFieldsValue({
			name: detail.name,
			code: detail.code,
			sort: detail.sort,
			description: detail.description,
			dataScope: detail.dataScope,
			deptIds: detail.deptIds || [],
			deptCheckStrictly: detail.deptCheckStrictly,
		});
		setDeptCheckedKeys(detail.deptIds || []);
		setDrawerOpen(true);
	};

	const saveRole = async () => {
		const values = await form.validateFields();
		values.deptIds = deptCheckedKeys;
		setSaving(true);
		try {
			if (editing) {
				await systemRoleService.updateRole(editing.id, values);
				toast.success("修改成功");
			} else {
				await systemRoleService.createRole(values);
				toast.success("新增成功");
			}
			setDrawerOpen(false);
			await roleQuery.refetch();
		} finally {
			setSaving(false);
		}
	};

	const deleteRole = (r: RoleResp) => {
		Modal.warning({
			title: "提示",
			content: `是否确定删除角色「${r.name}」？`,
			okText: "删除",
			cancelText: "取消",
			okButtonProps: { danger: true },
			onOk: async () => {
				await systemRoleService.deleteRole([r.id]);
				toast.success("删除成功");
				await roleQuery.refetch();
			},
		});
	};

	const deptTree = deptQuery.data || [];
	const deptNodes = useMemo(() => treeToNodes(deptTree as DeptResp[]), [deptTree]);

	return (
		<Card className="h-full">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Input value={searchKey} onChange={(e) => setSearchKey(e.target.value)} placeholder="搜索名称/编码" />
					<Button disabled={!canCreate} onClick={openAdd}>
						新增
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<Tree
					blockNode
					selectedKeys={selectedRoleId ? [selectedRoleId] : []}
					treeData={roleNodes}
					onSelect={(keys) => {
						const id = keys?.[0] ? Number(keys[0]) : undefined;
						if (id) onSelectRole(id);
					}}
					titleRender={(node) => {
						const roleId = Number(node.key);
						const role = roles.find((x) => x.id === roleId);
						return (
							<div className="flex items-center justify-between gap-2">
								<span className="truncate">{String(node.title)}</span>
								{role ? (
									<div className="flex items-center gap-1">
										<Button variant="ghost" size="sm" disabled={!canUpdate} onClick={() => openEdit(roleId)}>
											修改
										</Button>
										<Button
											variant="ghost"
											size="sm"
											disabled={!canDelete || role.disabled}
											onClick={() => deleteRole(role)}
										>
											删除
										</Button>
									</div>
								) : null}
							</div>
						);
					}}
				/>

				<Drawer
					open={drawerOpen}
					title={editing ? "修改角色" : "新增角色"}
					onClose={() => setDrawerOpen(false)}
					width={560}
					footer={
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setDrawerOpen(false)}>
								取消
							</Button>
							<Button onClick={saveRole} disabled={saving}>
								保存
							</Button>
						</div>
					}
				>
					<Form form={form} layout="vertical">
						<div className="grid grid-cols-1 gap-3">
							<Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入名称" }]}>
								<input className="w-full border rounded px-3 py-2" />
							</Form.Item>
							<Form.Item label="编码" name="code" rules={[{ required: true, message: "请输入编码" }]}>
								<input className="w-full border rounded px-3 py-2" disabled={Boolean(editing)} />
							</Form.Item>
							<Form.Item label="排序" name="sort" rules={[{ required: true, message: "请输入排序" }]}>
								<input className="w-full border rounded px-3 py-2" type="number" min={1} />
							</Form.Item>
							<Form.Item label="描述" name="description">
								<textarea className="w-full border rounded px-3 py-2" rows={3} />
							</Form.Item>
							<Form.Item label="数据权限" name="dataScope" rules={[{ required: true, message: "请选择数据权限" }]}>
								<Select
									options={[
										{ value: 1, label: "全部数据" },
										{ value: 2, label: "本部门及以下" },
										{ value: 3, label: "本部门" },
										{ value: 4, label: "仅本人" },
										{ value: 5, label: "自定义部门" },
									]}
								/>
							</Form.Item>
							<Form.Item noStyle shouldUpdate={(p, c) => p.dataScope !== c.dataScope}>
								{() => {
									const scope = Number(form.getFieldValue("dataScope") ?? 4);
									if (scope !== 5) return null;
									const linked = Boolean(form.getFieldValue("deptCheckStrictly"));
									return (
										<Form.Item label="部门范围">
											<Tree
												checkable
												defaultExpandAll
												checkStrictly={!linked}
												treeData={deptNodes}
												checkedKeys={deptCheckedKeys as any}
												onCheck={(keys) => {
													const list = Array.isArray(keys) ? (keys as any) : (keys as any)?.checked;
													const normalized = (list || []).map((x: any) => Number(x));
													setDeptCheckedKeys(normalized);
													form.setFieldValue("deptIds", normalized);
												}}
											/>
										</Form.Item>
									);
								}}
							</Form.Item>
							<Form.Item label="父子联动" name="deptCheckStrictly" valuePropName="checked">
								<input
									type="checkbox"
									onChange={(e) => {
										form.setFieldValue("deptCheckStrictly", e.target.checked);
									}}
								/>
							</Form.Item>
						</div>
					</Form>
				</Drawer>
			</CardContent>
		</Card>
	);
}

function RolePermissionTab({ roleId }: { roleId: number }) {
	const { checkAny } = useAuthCheck("permission");
	const canUpdate = checkAny(["system:role:updatePermission"]);

	const roleDetailQuery = useQuery({
		queryKey: ["system.role.detail", roleId],
		queryFn: () => systemRoleService.getRole(roleId),
		enabled: roleId > 0,
	});

	const menuTreeQuery = useQuery({
		queryKey: ["system.menu.tree"],
		queryFn: () => systemMenuService.listMenuTree(),
	});

	const menus = menuTreeQuery.data || [];
	const menuNodes = useMemo(() => treeToNodes(menus), [menus]);
	const allMenuIds = useMemo(() => flattenMenuIds(menus), [menus]);

	const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
	const [menuCheckStrictly, setMenuCheckStrictly] = useState(true);

	useEffect(() => {
		const d = roleDetailQuery.data;
		if (!d) return;
		setCheckedKeys(d.menuIds || []);
		setMenuCheckStrictly(Boolean(d.menuCheckStrictly));
	}, [roleDetailQuery.data]);

	const save = async () => {
		await systemRoleService.updateRolePermission(roleId, { menuIds: checkedKeys, menuCheckStrictly });
		toast.success("保存成功");
		roleDetailQuery.refetch();
	};

	const toggleAll = () => {
		if (checkedKeys.length === allMenuIds.length) {
			setCheckedKeys([]);
			return;
		}
		setCheckedKeys(allMenuIds);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="font-semibold">功能权限</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => menuTreeQuery.refetch()}>
							刷新菜单
						</Button>
						<Button variant="outline" onClick={toggleAll}>
							全选/全不选
						</Button>
						<Button
							variant="outline"
							onClick={() => setMenuCheckStrictly((v) => !v)}
						>
							父子联动：{menuCheckStrictly ? "是" : "否"}
						</Button>
						<Button disabled={!canUpdate} onClick={save}>
							保存
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Tree
					checkable
					defaultExpandAll
					checkStrictly={!menuCheckStrictly}
					treeData={menuNodes}
					checkedKeys={checkedKeys as any}
					onCheck={(keys) => {
						const list = Array.isArray(keys) ? (keys as any) : (keys as any)?.checked;
						setCheckedKeys((list || []).map((x: any) => Number(x)));
					}}
				/>
			</CardContent>
		</Card>
	);
}

function RoleUserTab({ roleId }: { roleId: number }) {
	const { checkAny } = useAuthCheck("permission");
	const canAssign = checkAny(["system:role:assignToUsers"]);
	const canUnassign = checkAny(["system:role:unassignFromUsers"]);

	const [page, setPage] = useState(1);
	const [size, setSize] = useState(10);
	const [description, setDescription] = useState("");
	const [assignOpen, setAssignOpen] = useState(false);
	const [assignSelected, setAssignSelected] = useState<number[]>([]);

	const userPageQuery = useQuery({
		queryKey: ["system.role.user.page", roleId, page, size, description],
		queryFn: () => systemRoleService.pageRoleUser(roleId, { page, size, description: description || undefined }),
		enabled: roleId > 0,
	});

	const users = userPageQuery.data?.list || [];
	const total = userPageQuery.data?.total || 0;

	const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

	const columns = [
		{ title: "用户名", dataIndex: "username", width: 160 },
		{ title: "昵称", dataIndex: "nickname", width: 160 },
		{ title: "部门", dataIndex: "deptName", width: 180 },
		{ title: "状态", dataIndex: "status", width: 80, render: (v: number) => (v === 1 ? "启用" : "禁用") },
		{ title: "描述", dataIndex: "description", width: 220 },
	];

	const openAssign = async () => {
		setAssignOpen(true);
		setAssignSelected([]);
	};

	const candidateQuery = useQuery({
		queryKey: ["system.user.page.assign", assignOpen, description],
		queryFn: () => systemUserService.listUserPage({ page: 1, size: 100, description: description || undefined }),
		enabled: assignOpen,
	});

	const candidates = candidateQuery.data?.list || [];

	const doAssign = async () => {
		if (!assignSelected.length) {
			toast.error("请选择用户");
			return;
		}
		await systemRoleService.assignToUsers(roleId, assignSelected);
		toast.success("分配成功");
		setAssignOpen(false);
		userPageQuery.refetch();
	};

	const unassign = async () => {
		if (!selectedRowKeys.length) {
			toast.error("请选择要取消的记录");
			return;
		}
		await systemRoleService.unassignFromUsers(selectedRowKeys);
		toast.success("取消成功");
		setSelectedRowKeys([]);
		userPageQuery.refetch();
	};

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { Table } = require("antd") as typeof import("antd");

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="font-semibold">角色用户</div>
					<div className="flex items-center gap-2">
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="用户名/昵称/描述" className="w-60" />
						<Button variant="outline" onClick={() => userPageQuery.refetch()}>
							刷新
						</Button>
						<Button disabled={!canAssign} onClick={openAssign}>
							分配用户
						</Button>
						<Button disabled={!canUnassign} variant="outline" onClick={unassign}>
							取消分配
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<RoleUserResp>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={userPageQuery.isFetching}
					columns={columns}
					dataSource={users}
					rowSelection={{
						selectedRowKeys,
						onChange: (keys) => setSelectedRowKeys(keys as number[]),
					}}
					pagination={{
						current: page,
						pageSize: size,
						total,
						showSizeChanger: true,
						onChange: (p, s) => {
							setPage(p);
							setSize(s);
						},
					}}
				/>

				<Modal
					open={assignOpen}
					title="分配用户"
					onCancel={() => setAssignOpen(false)}
					onOk={doAssign}
					okText="保存"
					cancelText="取消"
					width={640}
				>
					<div className="space-y-3">
						<div className="text-sm text-text-secondary">从用户列表中选择要分配到当前角色的用户</div>
						<Select
							mode="multiple"
							style={{ width: "100%" }}
							placeholder="选择用户"
							options={candidates.map((u) => ({ value: u.id, label: `${u.nickname}(${u.username})` }))}
							value={assignSelected}
							onChange={(v) => setAssignSelected(v as number[])}
						/>
					</div>
				</Modal>
			</CardContent>
		</Card>
	);
}

export default function BackendSystemRolePage({ route }: { route?: BackendRouteItem }) {
	const [roleId, setRoleId] = useState<number | undefined>(undefined);
	const [activeTab, setActiveTab] = useState<"permission" | "user">("permission");

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
			<RoleTree selectedRoleId={roleId} onSelectRole={setRoleId} />
			<div className="space-y-4">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex flex-col">
								<div className="text-base font-semibold">角色管理</div>
								{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<Tabs
							activeKey={activeTab}
							onChange={(k) => setActiveTab(k as any)}
							items={[
								{ key: "permission", label: "功能权限" },
								{ key: "user", label: "角色用户" },
							]}
						/>
					</CardContent>
				</Card>

				{roleId ? (
					activeTab === "permission" ? (
						<RolePermissionTab roleId={roleId} />
					) : (
						<RoleUserTab roleId={roleId} />
					)
				) : (
					<Card>
						<CardContent className="text-sm text-text-secondary">请先选择角色。</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
