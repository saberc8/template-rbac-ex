// 后端路由页面：系统管理-部门管理（对齐 pc-admin-vue3：新增/编辑/删除/导出/展开折叠/筛选）。

import systemDeptService from "@/api/services/systemDeptService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, Form, Modal, Radio, Select, Table, Tree, TreeSelect } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { DeptResp, DeptSaveReq } from "#/system";

const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const flattenIds = (list: DeptResp[]): number[] => {
	const out: number[] = [];
	const walk = (arr: DeptResp[]) => {
		for (const it of arr) {
			out.push(it.id);
			if (it.children?.length) walk(it.children);
		}
	};
	walk(list);
	return out;
};

const treeToSelect = (list: DeptResp[]): any[] =>
	list.map((d) => ({
		value: d.id,
		title: d.name,
		children: d.children?.length ? treeToSelect(d.children) : undefined,
	}));

const deptToTreeNodes = (list: DeptResp[]): any[] =>
	list.map((d) => ({
		key: d.id,
		title: d.name,
		raw: d,
		children: d.children?.length ? deptToTreeNodes(d.children) : undefined,
	}));

export default function BackendSystemDeptPage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:dept:create"]);
	const canUpdate = checkAny(["system:dept:update"]);
	const canDelete = checkAny(["system:dept:delete"]);
	const canExport = checkAny(["system:dept:export"]);

	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
	const [viewType, setViewType] = useState<"table" | "tree">("table");

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<DeptResp | null>(null);
	const [form] = Form.useForm<DeptSaveReq>();

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.dept.tree", description, status],
		queryFn: () =>
			systemDeptService.listDeptTree({
				description: description || undefined,
				status: status || undefined,
			}),
	});

	const treeSelectData = useMemo(() => treeToSelect(data || []), [data]);

	const openCreate = (parent?: DeptResp) => {
		setEditing(null);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			name: "",
			parentId: parent?.id || 0,
			sort: 1,
			status: 1,
			description: "",
		});
	};

	const openEdit = (record: DeptResp) => {
		setEditing(record);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			name: record.name,
			parentId: record.parentId,
			sort: record.sort,
			status: record.status,
			description: record.description,
		});
	};

	const onSubmit = async () => {
		const values = await form.validateFields();
		if (editing) {
			await systemDeptService.updateDept(editing.id, values);
			toast.success("修改成功");
		} else {
			await systemDeptService.createDept(values);
			toast.success("新增成功");
		}
		setModalOpen(false);
		refetch();
	};

	const columns: ColumnsType<DeptResp> = [
		{ title: "名称", dataIndex: "name", width: 220 },
		{ title: "描述", dataIndex: "description", width: 260 },
		{ title: "排序", dataIndex: "sort", width: 80 },
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (v: number) => (v === 1 ? "启用" : "禁用"),
		},
		{
			title: "系统内置",
			dataIndex: "isSystem",
			width: 100,
			render: (v: boolean) => (v ? "是" : "否"),
		},
		{ title: "创建时间", dataIndex: "createTime", width: 200 },
		{
			title: "操作",
			key: "op",
			width: 280,
			fixed: "right",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => openCreate(record)} disabled={!canCreate}>
						新增子级
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => openEdit(record)}
						disabled={!canUpdate || record.isSystem}
					>
						编辑
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canDelete || record.isSystem}
						onClick={async () => {
							const ok = window.confirm(`确认删除部门「${record.name}」？`);
							if (!ok) return;
							await systemDeptService.deleteDept([record.id]);
							toast.success("删除成功");
							refetch();
						}}
					>
						删除
					</Button>
				</div>
			),
		},
	];

	const treeNodes = useMemo(() => deptToTreeNodes(data || []), [data]);

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">部门管理</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Radio.Group
								value={viewType}
								onChange={(e) => setViewType(e.target.value)}
								optionType="button"
								buttonStyle="solid"
								options={[
									{ label: "表格视图", value: "table" },
									{ label: "组织架构图", value: "tree" },
								]}
							/>
							<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="名称/描述" className="w-56" />
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
							<Button variant="outline" onClick={() => setExpandedRowKeys(flattenIds(data || []))} disabled={!data?.length}>
								展开
							</Button>
							<Button variant="outline" onClick={() => setExpandedRowKeys([])} disabled={!expandedRowKeys.length}>
								折叠
							</Button>
							<Button
								variant="outline"
								disabled={!canExport}
								onClick={async () => {
									const resp = await systemDeptService.exportDept({
										description: description || undefined,
										status: status || undefined,
									});
									downloadBlob(resp.data, "dept.csv");
								}}
							>
								导出
							</Button>
							<Button variant="outline" onClick={() => refetch()}>
								刷新
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{viewType === "table" ? (
						<Table<DeptResp>
							rowKey="id"
							size="small"
							loading={isFetching}
							scroll={{ x: "max-content" }}
							columns={columns}
							dataSource={data || []}
							pagination={false}
							expandable={{
								expandedRowKeys,
								onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as number[]),
							}}
						/>
					) : (
						<Tree
							blockNode
							defaultExpandAll
							treeData={treeNodes}
							titleRender={(node: any) => (
								<div className="flex items-center justify-between gap-2">
									<div className="min-w-0 truncate">{String(node.title || "")}</div>
									<Dropdown
										menu={{
											items: [
												canCreate ? { key: "add", label: "新增子级" } : null,
												canUpdate ? { key: "edit", label: "编辑" } : null,
												canDelete ? { key: "delete", label: "删除" } : null,
											].filter(Boolean) as any,
											onClick: async ({ key }) => {
												const dept = node.raw as DeptResp;
												if (key === "add") openCreate(dept);
												if (key === "edit") openEdit(dept);
												if (key === "delete") {
													const ok = window.confirm(`确认删除部门「${dept.name}」？`);
													if (!ok) return;
													await systemDeptService.deleteDept([dept.id]);
													toast.success("删除成功");
													refetch();
												}
											},
										}}
										trigger={["click"]}
									>
										<Button variant="ghost" size="sm">
											更多
										</Button>
									</Dropdown>
								</div>
							)}
						/>
					)}
				</CardContent>
			</Card>

			<Modal
				open={modalOpen}
				title={editing ? "编辑部门" : "新增部门"}
				onCancel={() => setModalOpen(false)}
				onOk={onSubmit}
				okButtonProps={{ disabled: editing ? !canUpdate : !canCreate }}
				destroyOnClose
				width={720}
			>
				<Form form={form} layout="vertical" preserve={false}>
					<div className="grid grid-cols-2 gap-3">
						<Form.Item name="name" label="部门名称" rules={[{ required: true, message: "请输入部门名称" }]}>
							<Input placeholder="例如：研发部" />
						</Form.Item>
						<Form.Item name="parentId" label="上级部门" rules={[{ required: true, message: "请选择上级部门" }]}>
							<TreeSelect
								treeDefaultExpandAll
								allowClear
								placeholder="根节点请选择空"
								treeData={[{ value: 0, title: "根节点", children: treeSelectData }]}
							/>
						</Form.Item>
						<Form.Item name="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
							<Select options={Array.from({ length: 50 }).map((_, i) => ({ label: String(i + 1), value: i + 1 }))} />
						</Form.Item>
						<Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
							<Select options={[{ label: "启用", value: 1 }, { label: "禁用", value: 2 }]} />
						</Form.Item>
					</div>
					<Form.Item name="description" label="描述">
						<Input placeholder="描述信息" />
					</Form.Item>
				</Form>
			</Modal>
		</>
	);
}
