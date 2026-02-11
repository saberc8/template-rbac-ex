import { systemDictService, type SysDict, type SysDictCreateReq, type SysDictUpdateReq } from "@/api/services/systemDictService";
import { systemDictItemService, type SysDictItemRow, type SysDictItemSaveReq } from "@/api/services/systemDictItemService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { BasicStatus } from "#/enum";
import { toast } from "sonner";
import DictItemFormDialog from "./dict-item-form-dialog";
import DictFormDialog from "./dict-form-dialog";

export default function DictPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [selectedDict, setSelectedDict] = useState<SysDict | null>(null);
	const [dictFormOpen, setDictFormOpen] = useState(false);
	const [dictFormMode, setDictFormMode] = useState<"create" | "update">("create");
	const [editingDict, setEditingDict] = useState<SysDict | null>(null);

	const [itemKeyword, setItemKeyword] = useState("");
	const [itemStatus, setItemStatus] = useState("");
	const [itemPage, setItemPage] = useState(1);
	const [itemPageSize, setItemPageSize] = useState(30);
	const [itemQuery, setItemQuery] = useState<{ description?: string; status?: number }>({});
	const [itemFormOpen, setItemFormOpen] = useState(false);
	const [itemFormMode, setItemFormMode] = useState<"create" | "update">("create");
	const [editingItemId, setEditingItemId] = useState<number | null>(null);

	const { data, isFetching } = useQuery({
		queryKey: ["systemDict.list", queryKeyword],
		queryFn: () => systemDictService.list(queryKeyword || undefined),
	});

	const createDictMutation = useMutation({
		mutationFn: (payload: SysDictCreateReq) => systemDictService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDict.list"] });
		},
	});
	const updateDictMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysDictUpdateReq }) => systemDictService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDict.list"] });
		},
	});
	const deleteDictMutation = useMutation({
		mutationFn: (ids: number[]) => systemDictService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDict.list"] });
		},
	});

	const onSubmitDict = async (payload: SysDictCreateReq | SysDictUpdateReq) => {
		try {
			if (dictFormMode === "create") {
				await createDictMutation.mutateAsync(payload as SysDictCreateReq);
				toast.success("新增成功", { position: "top-center" });
			} else if (dictFormMode === "update" && editingDict) {
				await updateDictMutation.mutateAsync({ id: Number(editingDict.id), payload: payload as SysDictUpdateReq });
				toast.success("保存成功", { position: "top-center" });
			}
			setDictFormOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	const columns: ColumnsType<SysDict> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 220 },
			{ title: "Code", dataIndex: "code", width: 220 },
			{ title: "Description", dataIndex: "description" },
			{
				title: "System",
				dataIndex: "isSystem",
				width: 120,
				render: (v: boolean) => (v ? "Yes" : "No"),
			},
			{
				title: "操作",
				key: "actions",
				width: 160,
				fixed: "right",
				render: (_: any, record: SysDict) => (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:dict:update") || record.isSystem || updateDictMutation.isPending}
							onClick={() => {
								setDictFormMode("update");
								setEditingDict(record);
								setDictFormOpen(true);
							}}
						>
							编辑
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:dict:delete") || record.isSystem || deleteDictMutation.isPending}
							onClick={() => {
								Modal.confirm({
									title: "确认删除？",
									content: `字典：${record.name} (${record.code})`,
									okText: "删除",
									cancelText: "取消",
									okButtonProps: { danger: true },
									onOk: async () => {
										try {
											await deleteDictMutation.mutateAsync([Number(record.id)]);
											if (selectedDict?.id === record.id) setSelectedDict(null);
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
		[can, deleteDictMutation.isPending, selectedDict?.id, updateDictMutation.isPending],
	);

	const { data: itemData, isFetching: isItemFetching } = useQuery({
		queryKey: ["systemDictItem.page", selectedDict?.id || 0, itemPage, itemPageSize, itemQuery],
		enabled: Boolean(selectedDict?.id),
		queryFn: () =>
			systemDictItemService.page({
				dictId: selectedDict!.id,
				page: itemPage,
				size: itemPageSize,
				description: itemQuery.description,
				status: itemQuery.status,
			}),
	});

	const createItemMutation = useMutation({
		mutationFn: (payload: SysDictItemSaveReq & { dictId: number }) => systemDictItemService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDictItem.page"] });
		},
	});
	const updateItemMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysDictItemSaveReq }) => systemDictItemService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDictItem.page"] });
		},
	});
	const deleteItemMutation = useMutation({
		mutationFn: (ids: number[]) => systemDictItemService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDictItem.page"] });
		},
	});
	const clearCacheMutation = useMutation({
		mutationFn: (code: string) => systemDictService.clearCache(code),
	});

	const onSubmitItem = async (payload: SysDictItemSaveReq) => {
		try {
			if (!selectedDict?.id) {
				toast.error("请先选择字典", { position: "top-center" });
				return;
			}
			if (itemFormMode === "create") {
				await createItemMutation.mutateAsync({ ...payload, dictId: Number(selectedDict.id) });
				toast.success("新增成功", { position: "top-center" });
			} else if (itemFormMode === "update" && editingItemId) {
				const { dictId: _ignoredDictId, ...rest } = payload;
				await updateItemMutation.mutateAsync({ id: Number(editingItemId), payload: rest });
				toast.success("保存成功", { position: "top-center" });
			}
			setItemFormOpen(false);
		} catch {
			// handled by apiClient
		}
	};

	const renderLabel = (record: SysDictItemRow) => {
		const text = record.label || "";
		const c = (record.color || "").trim();
		if (!c) return text;
		if (c === "primary") return <Tag color="blue">{text}</Tag>;
		if (c === "success") return <Tag color="green">{text}</Tag>;
		if (c === "warning") return <Tag color="orange">{text}</Tag>;
		if (c === "error") return <Tag color="red">{text}</Tag>;
		if (c === "default") return <Tag>{text}</Tag>;
		return text;
	};

	const itemColumns: ColumnsType<SysDictItemRow> = useMemo(
		() => [
			{ title: "Label", dataIndex: "label", width: 220, render: (_: any, record) => renderLabel(record) },
			{ title: "Value", dataIndex: "value", width: 220 },
			{ title: "Color", dataIndex: "color", width: 120 },
			{ title: "Order", dataIndex: "sort", width: 90 },
			{
				title: "Status",
				dataIndex: "status",
				width: 110,
				render: (v: number) => (Number(v) === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ title: "Desc", dataIndex: "description", width: 260, ellipsis: true },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
			{
				title: "操作",
				key: "actions",
				width: 160,
				fixed: "right",
				render: (_: any, record: SysDictItemRow) => (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!can("system:dict:item:update") || updateItemMutation.isPending}
							onClick={() => {
								setItemFormMode("update");
								setEditingItemId(Number(record.id));
								setItemFormOpen(true);
							}}
						>
							编辑
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("system:dict:item:delete") || deleteItemMutation.isPending}
							onClick={() => {
								Modal.confirm({
									title: "确认删除？",
									content: `字典项：${record.label}`,
									okText: "删除",
									cancelText: "取消",
									okButtonProps: { danger: true },
									onOk: async () => {
										try {
											await deleteItemMutation.mutateAsync([Number(record.id)]);
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
		[can, deleteItemMutation, updateItemMutation.isPending],
	);

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>Dict</div>
						<div className="flex items-center gap-2">
							{can("system:dict:create") && (
								<Button
									onClick={() => {
										setDictFormMode("create");
										setEditingDict(null);
										setDictFormOpen(true);
									}}
								>
									新增
								</Button>
							)}
							<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search description" className="w-[240px]" />
							<Button
								onClick={() => {
									setQueryKeyword(keyword.trim());
								}}
							>
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<SysDict>
						rowKey="id"
						size="small"
						scroll={{ x: "max-content" }}
						pagination={false}
						loading={isFetching}
						columns={columns}
						dataSource={data || []}
						onRow={(record) => ({
							onClick: () => {
								setSelectedDict(record);
								setItemPage(1);
							},
						})}
						rowClassName={(record) => (record.id === selectedDict?.id ? "bg-muted/50" : "")}
					/>
					<DictFormDialog
						open={dictFormOpen}
						mode={dictFormMode}
						initial={editingDict}
						busy={createDictMutation.isPending || updateDictMutation.isPending}
						onOpenChange={setDictFormOpen}
						onSubmit={onSubmitDict}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="truncate">{selectedDict ? `Items - ${selectedDict.name}` : "Items"}</div>
						<div className="flex flex-wrap items-center gap-2">
							{can("system:dict:item:create") && (
								<Button
									disabled={!selectedDict}
									onClick={() => {
										setItemFormMode("create");
										setEditingItemId(null);
										setItemFormOpen(true);
									}}
								>
									新增
								</Button>
							)}
							{can("system:dict:item:clearCache") && (
								<Button
									variant="secondary"
									disabled={!selectedDict || clearCacheMutation.isPending}
									onClick={async () => {
										if (!selectedDict?.code) {
											toast.error("请先选择字典", { position: "top-center" });
											return;
										}
										Modal.confirm({
											title: "确认清除缓存？",
											content: `字典：${selectedDict.name} (${selectedDict.code})`,
											okText: "清除",
											cancelText: "取消",
											okButtonProps: { danger: true },
											onOk: async () => {
												try {
													await clearCacheMutation.mutateAsync(selectedDict.code);
													toast.success("清除成功", { position: "top-center" });
												} catch {
													// handled by apiClient
												}
											},
										});
									}}
								>
									清缓存
								</Button>
							)}
							<Input value={itemKeyword} onChange={(e) => setItemKeyword(e.target.value)} placeholder="Search description" className="w-[200px]" />
							<Input value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} placeholder="Status(1/2)" className="w-[110px]" />
							<Button
								disabled={!selectedDict}
								onClick={() => {
									const s = Number(itemStatus.trim());
									setItemPage(1);
									setItemQuery({
										description: itemKeyword.trim() || undefined,
										status: Number.isFinite(s) ? s : undefined,
									});
								}}
							>
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<SysDictItemRow>
						rowKey="id"
						size="small"
						scroll={{ x: "max-content" }}
						loading={isItemFetching}
						columns={itemColumns}
						dataSource={itemData?.list || []}
						pagination={{
							current: itemPage,
							pageSize: itemPageSize,
							total: itemData?.total || 0,
							showSizeChanger: true,
							onChange: (p, s) => {
								setItemPage(p);
								setItemPageSize(s);
							},
						}}
					/>
					{!selectedDict && <div className="mt-3 text-sm text-muted-foreground">请先从左侧选择一个字典</div>}
					<DictItemFormDialog
						open={itemFormOpen}
						mode={itemFormMode}
						dictId={selectedDict?.id || null}
						id={editingItemId}
						busy={createItemMutation.isPending || updateItemMutation.isPending}
						onOpenChange={setItemFormOpen}
						onSubmit={onSubmitItem}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
