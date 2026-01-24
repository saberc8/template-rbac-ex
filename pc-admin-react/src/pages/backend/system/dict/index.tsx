// 后端路由页面：系统管理-字典管理（对齐 pc-admin-vue3：字典列表 + 字典项管理 + 清缓存）。

import systemDictItemService from "@/api/services/systemDictItemService";
import systemDictService from "@/api/services/systemDictService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, Form, Modal, Select, Table, Tag, Tree } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { DictItemResp, DictItemSaveReq, DictResp, DictSaveReq } from "#/system";

export default function BackendSystemDictPage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canDictCreate = checkAny(["system:dict:create"]);
	const canDictUpdate = checkAny(["system:dict:update"]);
	const canDictDelete = checkAny(["system:dict:delete"]);
	const canDictClearCache = checkAny(["system:dict:item:clearCache"]);
	const canItemCreate = checkAny(["system:dict:item:create"]);
	const canItemUpdate = checkAny(["system:dict:item:update"]);
	const canItemDelete = checkAny(["system:dict:item:delete"]);

	const [dictKeyword, setDictKeyword] = useState("");
	const [currentDictId, setCurrentDictId] = useState<number | null>(null);

	const [itemPage, setItemPage] = useState(1);
	const [itemSize, setItemSize] = useState(10);
	const [itemDescription, setItemDescription] = useState("");
	const [itemStatus, setItemStatus] = useState<number | undefined>(undefined);

	const [dictModalOpen, setDictModalOpen] = useState(false);
	const [dictEditing, setDictEditing] = useState<DictResp | null>(null);
	const [dictForm] = Form.useForm<DictSaveReq>();

	const [itemModalOpen, setItemModalOpen] = useState(false);
	const [itemEditing, setItemEditing] = useState<DictItemResp | null>(null);
	const [itemForm] = Form.useForm<DictItemSaveReq>();

	const dictQuery = useQuery({
		queryKey: ["system.dict.list", dictKeyword],
		queryFn: () => systemDictService.listDict({ description: dictKeyword || undefined }),
	});

	useEffect(() => {
		if (currentDictId) return;
		const first = (dictQuery.data || [])[0];
		if (first) setCurrentDictId(first.id);
	}, [dictQuery.data, currentDictId]);

	const currentDict = useMemo(
		() => (dictQuery.data || []).find((d) => d.id === currentDictId) || null,
		[dictQuery.data, currentDictId],
	);

	const dictNodes = useMemo(() => {
		const kw = dictKeyword.trim().toLowerCase();
		const list = (dictQuery.data || []).filter((d) => {
			if (!kw) return true;
			return String(d.name || "").toLowerCase().includes(kw) || String(d.code || "").toLowerCase().includes(kw);
		});
		return list.map((d) => ({
			key: d.id,
			title: `${d.name}（${d.code}）`,
			raw: d,
		}));
	}, [dictQuery.data, dictKeyword]);

	const itemQuery = useQuery({
		queryKey: ["system.dict.item.page", currentDictId, itemPage, itemSize, itemDescription, itemStatus],
		queryFn: () =>
			systemDictItemService.listDictItemPage({
				page: itemPage,
				size: itemSize,
				dictId: currentDictId || undefined,
				description: itemDescription || undefined,
				status: itemStatus || undefined,
			}),
		enabled: typeof currentDictId === "number" && currentDictId > 0,
	});

	const openDictCreate = () => {
		setDictEditing(null);
		setDictModalOpen(true);
		dictForm.resetFields();
		dictForm.setFieldsValue({ name: "", code: "", description: "" });
	};

	const openDictEdit = (record: DictResp) => {
		setDictEditing(record);
		setDictModalOpen(true);
		dictForm.resetFields();
		dictForm.setFieldsValue({ name: record.name, code: record.code, description: record.description });
	};

	const submitDict = async () => {
		const values = await dictForm.validateFields();
		if (dictEditing) {
			await systemDictService.updateDict(dictEditing.id, { name: values.name, code: dictEditing.code, description: values.description });
			toast.success("修改成功");
		} else {
			const created = await systemDictService.createDict(values);
			toast.success("新增成功");
			setCurrentDictId(created.id);
		}
		setDictModalOpen(false);
		dictQuery.refetch();
	};

	const openItemCreate = () => {
		if (!currentDictId) return;
		setItemEditing(null);
		setItemModalOpen(true);
		itemForm.resetFields();
		itemForm.setFieldsValue({
			dictId: currentDictId,
			label: "",
			value: "",
			color: "",
			sort: 1,
			description: "",
			status: 1,
		});
	};

	const openItemEdit = (record: DictItemResp) => {
		setItemEditing(record);
		setItemModalOpen(true);
		itemForm.resetFields();
		itemForm.setFieldsValue({
			dictId: record.dictId,
			label: record.label,
			value: record.value,
			color: record.color,
			sort: record.sort,
			description: record.description,
			status: record.status,
		});
	};

	const submitItem = async () => {
		const values = await itemForm.validateFields();
		if (itemEditing) {
			await systemDictItemService.updateDictItem(itemEditing.id, {
				label: values.label,
				value: values.value,
				color: values.color,
				sort: values.sort,
				description: values.description,
				status: values.status,
			});
			toast.success("修改成功");
		} else {
			await systemDictItemService.createDictItem(values);
			toast.success("新增成功");
		}
		setItemModalOpen(false);
		itemQuery.refetch();
	};

	const itemColumns: ColumnsType<DictItemResp> = [
		{
			title: "标签",
			dataIndex: "label",
			width: 180,
			render: (_, record) => {
				const c = String(record.color || "").toLowerCase();
				const map: Record<string, any> = {
					primary: { color: "blue" },
					success: { color: "green" },
					warning: { color: "orange" },
					error: { color: "red" },
					default: { color: "default" },
				};
				if (c && map[c]) return <Tag color={map[c].color}>{record.label}</Tag>;
				return record.label;
			},
		},
		{ title: "值", dataIndex: "value", width: 180 },
		{ title: "颜色", dataIndex: "color", width: 120 },
		{ title: "排序", dataIndex: "sort", width: 80 },
		{
			title: "状态",
			dataIndex: "status",
			width: 90,
			render: (v: number) => (v === 1 ? "启用" : "禁用"),
		},
		{ title: "描述", dataIndex: "description", width: 240 },
		{ title: "创建时间", dataIndex: "createTime", width: 180 },
		{
			title: "操作",
			key: "op",
			width: 170,
			fixed: "right",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => openItemEdit(record)} disabled={!canItemUpdate}>
						编辑
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canItemDelete}
						onClick={async () => {
							const ok = window.confirm(`确认删除字典项「${record.label}」？`);
							if (!ok) return;
							await systemDictItemService.deleteDictItem([record.id]);
							toast.success("删除成功");
							itemQuery.refetch();
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
			<div className="grid grid-cols-12 gap-3">
				<div className="col-span-12 lg:col-span-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between gap-3">
								<div className="flex flex-col">
									<div className="text-base font-semibold">字典列表</div>
									{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
								</div>
								<div className="flex items-center gap-2">
									<Button variant="outline" onClick={openDictCreate} disabled={!canDictCreate}>
										新增
									</Button>
									<Button variant="outline" onClick={() => dictQuery.refetch()}>
										刷新
									</Button>
								</div>
							</div>
							<div className="mt-3 flex items-center gap-2">
								<Input value={dictKeyword} onChange={(e) => setDictKeyword(e.target.value)} placeholder="名称/描述" className="w-full" />
							</div>
						</CardHeader>
						<CardContent>
							<Tree
								blockNode
								defaultExpandAll
								selectedKeys={currentDictId ? [currentDictId] : []}
								treeData={dictNodes}
								onSelect={(keys) => {
									const next = keys?.[0] ? Number(keys[0]) : null;
									if (!next) return;
									setCurrentDictId(next);
									setItemPage(1);
								}}
								titleRender={(node: any) => (
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0 truncate">{String(node.title || "")}</div>
										<Dropdown
											menu={{
												items: [
													canDictUpdate ? { key: "edit", label: "编辑" } : null,
													canDictDelete ? { key: "delete", label: "删除" } : null,
												].filter(Boolean) as any,
												onClick: async ({ key }) => {
													const record = node.raw as DictResp;
													if (key === "edit") openDictEdit(record);
													if (key === "delete") {
														const ok = window.confirm(`确认删除字典「${record.name}」？`);
														if (!ok) return;
														await systemDictService.deleteDict([record.id]);
														toast.success("删除成功");
														if (currentDictId === record.id) setCurrentDictId(null);
														dictQuery.refetch();
													}
												},
											}}
											trigger={["click"]}
										>
											<Button variant="ghost" size="sm" disabled={!canDictUpdate && !canDictDelete}>
												更多
											</Button>
										</Dropdown>
									</div>
								)}
							/>
						</CardContent>
					</Card>
				</div>

				<div className="col-span-12 lg:col-span-8">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between gap-3">
								<div className="flex flex-col">
									<div className="text-base font-semibold">字典项</div>
									<div className="text-xs text-text-secondary">
										当前字典：{currentDict ? `${currentDict.name}（${currentDict.code}）` : "-"}
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="描述" className="w-56" />
									<Select
										value={itemStatus}
										onChange={(v) => setItemStatus(v)}
										allowClear
										placeholder="状态"
										className="w-28"
										options={[
											{ label: "启用", value: 1 },
											{ label: "禁用", value: 2 },
										]}
									/>
									<Button variant="outline" onClick={openItemCreate} disabled={!currentDictId || !canItemCreate}>
										新增
									</Button>
									<Button
										variant="outline"
										disabled={!currentDict || !canDictClearCache}
										onClick={async () => {
											if (!currentDict) return;
											const ok = window.confirm(`确认清除字典「${currentDict.code}」缓存？`);
											if (!ok) return;
											await systemDictService.clearDictCache(currentDict.code);
											toast.success("已清除缓存");
										}}
									>
										清缓存
									</Button>
									<Button variant="outline" onClick={() => itemQuery.refetch()} disabled={!currentDictId}>
										刷新
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<Table<DictItemResp>
								rowKey="id"
								size="small"
								loading={itemQuery.isFetching}
								scroll={{ x: "max-content" }}
								columns={itemColumns}
								dataSource={itemQuery.data?.list || []}
								pagination={{
									current: itemPage,
									pageSize: itemSize,
									total: itemQuery.data?.total || 0,
									showSizeChanger: true,
									onChange: (p, s) => {
										setItemPage(p);
										setItemSize(s);
									},
								}}
							/>
						</CardContent>
					</Card>
				</div>
			</div>

			<Modal
				open={dictModalOpen}
				title={dictEditing ? "编辑字典" : "新增字典"}
				onCancel={() => setDictModalOpen(false)}
				onOk={submitDict}
				okButtonProps={{ disabled: dictEditing ? !canDictUpdate : !canDictCreate }}
				destroyOnClose
				width={720}
			>
				<Form form={dictForm} layout="vertical" preserve={false}>
					<div className="grid grid-cols-2 gap-3">
						<Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
							<Input />
						</Form.Item>
						<Form.Item
							name="code"
							label="编码"
							rules={[{ required: true, message: "请输入编码" }]}
							tooltip={dictEditing ? "编码创建后不可修改" : undefined}
						>
							<Input disabled={!!dictEditing} />
						</Form.Item>
					</div>
					<Form.Item name="description" label="描述">
						<Input />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				open={itemModalOpen}
				title={itemEditing ? "编辑字典项" : "新增字典项"}
				onCancel={() => setItemModalOpen(false)}
				onOk={submitItem}
				okButtonProps={{ disabled: itemEditing ? !canItemUpdate : !canItemCreate }}
				destroyOnClose
				width={760}
			>
				<Form form={itemForm} layout="vertical" preserve={false}>
					<div className="grid grid-cols-2 gap-3">
						<Form.Item name="label" label="标签" rules={[{ required: true, message: "请输入标签" }]}>
							<Input />
						</Form.Item>
						<Form.Item name="value" label="值" rules={[{ required: true, message: "请输入值" }]}>
							<Input />
						</Form.Item>
						<Form.Item name="color" label="颜色">
							<Input placeholder="#1677ff / red" />
						</Form.Item>
						<Form.Item name="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
							<Select options={Array.from({ length: 50 }).map((_, i) => ({ label: String(i + 1), value: i + 1 }))} />
						</Form.Item>
						<Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
							<Select options={[{ label: "启用", value: 1 }, { label: "禁用", value: 2 }]} />
						</Form.Item>
						<Form.Item name="dictId" label="字典" rules={[{ required: true, message: "请选择字典" }]}>
							<Select
								disabled={!!itemEditing}
								options={(dictQuery.data || []).map((d) => ({ label: `${d.name}（${d.code}）`, value: d.id }))}
							/>
						</Form.Item>
					</div>
					<Form.Item name="description" label="描述">
						<Input />
					</Form.Item>
				</Form>
			</Modal>
		</>
	);
}
