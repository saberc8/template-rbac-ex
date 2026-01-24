// 后端路由页面：系统管理-字典项管理（对齐 pc-admin-vue3：字典项分页/筛选/增改删）。

import systemDictItemService from "@/api/services/systemDictItemService";
import systemDictService from "@/api/services/systemDictService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Form, Modal, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { DictItemResp, DictItemSaveReq, DictResp } from "#/system";

export default function BackendSystemDictItemPage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canItemCreate = checkAny(["system:dict:item:create"]);
	const canItemUpdate = checkAny(["system:dict:item:update"]);
	const canItemDelete = checkAny(["system:dict:item:delete"]);

	const [dictId, setDictId] = useState<number | undefined>(undefined);
	const [page, setPage] = useState(1);
	const [size, setSize] = useState(10);
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<DictItemResp | null>(null);
	const [form] = Form.useForm<DictItemSaveReq>();

	const dictQuery = useQuery({
		queryKey: ["system.dict.list"],
		queryFn: () => systemDictService.listDict(),
	});

	useEffect(() => {
		if (dictId) return;
		const first = (dictQuery.data || [])[0];
		if (first) setDictId(first.id);
	}, [dictQuery.data, dictId]);

	const currentDict = useMemo(
		() => (dictQuery.data || []).find((d: DictResp) => d.id === dictId) || null,
		[dictQuery.data, dictId],
	);

	const itemQuery = useQuery({
		queryKey: ["system.dict.item.page", dictId, page, size, description, status],
		queryFn: () =>
			systemDictItemService.listDictItemPage({
				page,
				size,
				dictId,
				description: description || undefined,
				status: status || undefined,
			}),
		enabled: typeof dictId === "number" && dictId > 0,
	});

	const openCreate = () => {
		if (!dictId) return;
		setEditing(null);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			dictId,
			label: "",
			value: "",
			color: "",
			sort: 1,
			description: "",
			status: 1,
		});
	};

	const openEdit = (record: DictItemResp) => {
		setEditing(record);
		setModalOpen(true);
		form.resetFields();
		form.setFieldsValue({
			dictId: record.dictId,
			label: record.label,
			value: record.value,
			color: record.color,
			sort: record.sort,
			description: record.description,
			status: record.status,
		});
	};

	const onSubmit = async () => {
		const values = await form.validateFields();
		if (editing) {
			await systemDictItemService.updateDictItem(editing.id, {
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
		setModalOpen(false);
		itemQuery.refetch();
	};

	const columns: ColumnsType<DictItemResp> = [
		{ title: "标签", dataIndex: "label", width: 180 },
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
					<Button variant="outline" size="sm" onClick={() => openEdit(record)} disabled={!canItemUpdate}>
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
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">字典项管理</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Select
								value={dictId}
								onChange={(v) => {
									setDictId(v);
									setPage(1);
								}}
								placeholder="选择字典"
								className="w-72"
								options={(dictQuery.data || []).map((d: DictResp) => ({
									label: `${d.name}（${d.code}）`,
									value: d.id,
								}))}
							/>
							<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述" className="w-56" />
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
							<Button variant="outline" onClick={openCreate} disabled={!dictId || !canItemCreate}>
								新增
							</Button>
							<Button variant="outline" onClick={() => itemQuery.refetch()} disabled={!dictId}>
								刷新
							</Button>
						</div>
					</div>
					<div className="mt-2 text-xs text-text-secondary">当前字典：{currentDict ? `${currentDict.name}（${currentDict.code}）` : "-"}</div>
				</CardHeader>
				<CardContent>
					<Table<DictItemResp>
						rowKey="id"
						size="small"
						loading={itemQuery.isFetching}
						scroll={{ x: "max-content" }}
						columns={columns}
						dataSource={itemQuery.data?.list || []}
						pagination={{
							current: page,
							pageSize: size,
							total: itemQuery.data?.total || 0,
							showSizeChanger: true,
							onChange: (p, s) => {
								setPage(p);
								setSize(s);
							},
						}}
					/>
				</CardContent>
			</Card>

			<Modal
				open={modalOpen}
				title={editing ? "编辑字典项" : "新增字典项"}
				onCancel={() => setModalOpen(false)}
				onOk={onSubmit}
				okButtonProps={{ disabled: editing ? !canItemUpdate : !canItemCreate }}
				destroyOnClose
				width={760}
			>
				<Form form={form} layout="vertical" preserve={false}>
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
								disabled={!!editing}
								options={(dictQuery.data || []).map((d: DictResp) => ({ label: `${d.name}（${d.code}）`, value: d.id }))}
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
