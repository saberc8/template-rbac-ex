// 后端路由页面：系统管理-菜单管理（对齐 pc-admin-vue3：新增/编辑/删除/清缓存/展开折叠/筛选）。

import systemMenuService from "@/api/services/systemMenuService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Form, Modal, Select, Switch, Table, TreeSelect } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { MenuResp, MenuSaveReq } from "#/system";

type MenuFormModel = Omit<MenuSaveReq, "isExternal" | "isCache" | "isHidden"> & {
	isExternal: boolean;
	isCache: boolean;
	isHidden: boolean;
};

const treeToSelect = (list: MenuResp[]): any[] =>
	list.map((m) => ({
		value: m.id,
		title: m.title,
		children: m.children?.length ? treeToSelect(m.children) : undefined,
	}));

const flattenIds = (list: MenuResp[]): number[] => {
	const out: number[] = [];
	const walk = (arr: MenuResp[]) => {
		for (const it of arr) {
			out.push(it.id);
			if (it.children?.length) walk(it.children);
		}
	};
	walk(list);
	return out;
};

const filterTree = (list: MenuResp[], keyword: string, status?: number): MenuResp[] => {
	const kw = keyword.trim();
	if (!kw && status === undefined) return list;

	const match = (node: MenuResp) => {
		const hitKw =
			!kw ||
			node.title?.includes(kw) ||
			node.path?.includes(kw) ||
			node.component?.includes(kw) ||
			node.permission?.includes(kw);
		const hitStatus = status === undefined ? true : node.status === status;
		return hitKw && hitStatus;
	};

	const dfs = (nodes: MenuResp[]): MenuResp[] => {
		const out: MenuResp[] = [];
		for (const n of nodes) {
			const children = n.children?.length ? dfs(n.children) : [];
			if (match(n) || children.length) {
				out.push({ ...n, children });
			}
		}
		return out;
	};
	return dfs(list);
};

export default function BackendSystemMenuPage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:menu:create"]);
	const canUpdate = checkAny(["system:menu:update"]);
	const canDelete = checkAny(["system:menu:delete"]);
	const canClearCache = checkAny(["system:menu:clearCache"]);

	const [keyword, setKeyword] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<MenuResp | null>(null);
	const [form] = Form.useForm<MenuFormModel>();

	const treeQuery = useQuery({
		queryKey: ["system.menu.tree"],
		queryFn: () => systemMenuService.listMenuTree(),
	});

	const tableData = useMemo(() => filterTree(treeQuery.data || [], keyword, status), [treeQuery.data, keyword, status]);
	const treeSelectData = useMemo(() => treeToSelect(treeQuery.data || []), [treeQuery.data]);

	const openCreate = (parent?: MenuResp) => {
		setEditing(null);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			type: 2,
			title: "",
			parentId: parent?.id || 0,
			status: 1,
			sort: 1,
			path: "",
			name: "",
			component: "",
			redirect: "",
			icon: "",
			permission: "",
			isExternal: false,
			isCache: false,
			isHidden: false,
		});
	};

	const openEdit = (record: MenuResp) => {
		setEditing(record);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			type: record.type,
			title: record.title,
			parentId: record.parentId,
			status: record.status,
			sort: record.sort,
			path: record.path || "",
			name: record.name || "",
			component: record.component || "",
			redirect: record.redirect || "",
			icon: record.icon || "",
			permission: record.permission || "",
			isExternal: !!record.isExternal,
			isCache: !!record.isCache,
			isHidden: !!record.isHidden,
		});
	};

	const onSubmit = async () => {
		const values = await form.validateFields();
		const payload: MenuSaveReq = {
			...values,
			isExternal: values.isExternal,
			isCache: values.isCache,
			isHidden: values.isHidden,
		};

		if (editing) {
			await systemMenuService.updateMenu(editing.id, payload);
			toast.success("修改成功");
		} else {
			await systemMenuService.createMenu(payload);
			toast.success("新增成功");
		}
		setModalOpen(false);
		treeQuery.refetch();
	};

	const columns: ColumnsType<MenuResp> = [
		{ title: "标题", dataIndex: "title", width: 200 },
		{
			title: "类型",
			dataIndex: "type",
			width: 90,
			render: (v: number) => (v === 1 ? "目录" : v === 2 ? "菜单" : "按钮"),
		},
		{ title: "路径", dataIndex: "path", width: 220 },
		{ title: "组件", dataIndex: "component", width: 240 },
		{ title: "权限码", dataIndex: "permission", width: 240 },
		{ title: "图标", dataIndex: "icon", width: 140 },
		{
			title: "外链",
			dataIndex: "isExternal",
			width: 80,
			render: (v: boolean) => (v ? "是" : "否"),
		},
		{
			title: "缓存",
			dataIndex: "isCache",
			width: 80,
			render: (v: boolean) => (v ? "是" : "否"),
		},
		{
			title: "隐藏",
			dataIndex: "isHidden",
			width: 80,
			render: (v: boolean) => (v ? "是" : "否"),
		},
		{ title: "排序", dataIndex: "sort", width: 80 },
		{
			title: "状态",
			dataIndex: "status",
			width: 90,
			render: (v: number) => (v === 1 ? "启用" : "禁用"),
		},
		{
			title: "操作",
			key: "op",
			width: 260,
			fixed: "right",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => openCreate(record)} disabled={!canCreate}>
						新增子级
					</Button>
					<Button variant="outline" size="sm" onClick={() => openEdit(record)} disabled={!canUpdate}>
						编辑
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canDelete}
						onClick={async () => {
							const ok = window.confirm(`确认删除菜单「${record.title}」？`);
							if (!ok) return;
							await systemMenuService.deleteMenu([record.id]);
							toast.success("删除成功");
							treeQuery.refetch();
						}}
					>
						删除
					</Button>
				</div>
			),
		},
	];

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">菜单管理</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="标题/路径/组件/权限码" className="w-64" />
							<Select
								value={status}
								onChange={(v) => setStatus(v)}
								allowClear
								placeholder="状态"
								className="w-28"
								options={[
									{ label: "启用", value: 1 },
									{ label: "禁用", value: 2 },
								]}
							/>
							<Button variant="outline" onClick={() => openCreate()} disabled={!canCreate}>
								新增
							</Button>
							<Button
								variant="outline"
								onClick={() => setExpandedRowKeys(flattenIds(tableData))}
								disabled={!tableData.length}
							>
								展开
							</Button>
							<Button variant="outline" onClick={() => setExpandedRowKeys([])} disabled={!expandedRowKeys.length}>
								折叠
							</Button>
							<Button
								variant="outline"
								disabled={!canClearCache}
								onClick={async () => {
									const ok = window.confirm("确认清除菜单缓存？");
									if (!ok) return;
									await systemMenuService.clearMenuCache();
									toast.success("已清除菜单缓存");
								}}
							>
								清缓存
							</Button>
							<Button variant="outline" onClick={() => treeQuery.refetch()}>
								刷新
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<MenuResp>
						rowKey="id"
						size="small"
						loading={treeQuery.isFetching}
						scroll={{ x: "max-content" }}
						columns={columns}
						dataSource={tableData}
						pagination={false}
						expandable={{
							expandedRowKeys,
							onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as number[]),
						}}
					/>
				</CardContent>
			</Card>

			<Modal
				open={modalOpen}
				title={editing ? "编辑菜单" : "新增菜单"}
				onCancel={() => setModalOpen(false)}
				onOk={onSubmit}
				okButtonProps={{ disabled: editing ? !canUpdate : !canCreate }}
				destroyOnClose
				width={820}
			>
				<Form form={form} layout="vertical" preserve={false}>
					<div className="grid grid-cols-2 gap-3">
						<Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
							<Select
								options={[
									{ label: "目录", value: 1 },
									{ label: "菜单", value: 2 },
									{ label: "按钮", value: 3 },
								]}
							/>
						</Form.Item>
						<Form.Item name="parentId" label="上级菜单" rules={[{ required: true, message: "请选择上级菜单" }]}>
							<TreeSelect
								treeDefaultExpandAll
								allowClear
								placeholder="根节点请选择空"
								treeData={[{ value: 0, title: "根节点", children: treeSelectData }]}
							/>
						</Form.Item>
						<Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
							<Input placeholder="例如：用户管理" />
						</Form.Item>
						<Form.Item name="name" label="路由名称">
							<Input placeholder="例如：SystemUser" />
						</Form.Item>
						<Form.Item name="path" label="路由路径">
							<Input placeholder="例如：/system/user" />
						</Form.Item>
						<Form.Item name="component" label="组件路径">
							<Input placeholder="例如：system/user/index" />
						</Form.Item>
						<Form.Item name="redirect" label="重定向">
							<Input placeholder="例如：/system/user" />
						</Form.Item>
						<Form.Item name="permission" label="权限码">
							<Input placeholder="按钮权限才需要，如 system:user:create" />
						</Form.Item>
						<Form.Item name="icon" label="图标">
							<Input placeholder="例如：user / settings" />
						</Form.Item>
						<Form.Item name="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
							<Select
								options={Array.from({ length: 20 }).map((_, i) => ({ label: String(i + 1), value: i + 1 }))}
							/>
						</Form.Item>
						<Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
							<Select options={[{ label: "启用", value: 1 }, { label: "禁用", value: 2 }]} />
						</Form.Item>
					</div>

					<div className="grid grid-cols-3 gap-3">
						<Form.Item name="isExternal" label="是否外链" valuePropName="checked">
							<Switch />
						</Form.Item>
						<Form.Item name="isCache" label="是否缓存" valuePropName="checked">
							<Switch />
						</Form.Item>
						<Form.Item name="isHidden" label="是否隐藏" valuePropName="checked">
							<Switch />
						</Form.Item>
					</div>
				</Form>
			</Modal>
		</>
	);
}
