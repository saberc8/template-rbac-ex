import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import {
	type SysDictItemRow,
	type SysDictItemSaveReq,
	systemDictItemService,
} from "@/api/services/systemDictItemService";
import {
	type SysDict,
	type SysDictCreateReq,
	type SysDictUpdateReq,
	systemDictService,
} from "@/api/services/systemDictService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import Icon from "@/components/icon/icon";
import SplitLayout from "@/components/layout/split-layout";
import { useUserPermissions } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import SystemSideCard from "../components/system-side-card";
import SystemSideList from "../components/system-side-list";
import DictFormDialog from "./dict-form-dialog";
import DictItemFormDialog from "./dict-item-form-dialog";

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
	const [itemStatus, setItemStatus] = useState("all");
	const [itemPage, setItemPage] = useState(1);
	const [itemPageSize, setItemPageSize] = useState(30);
	const [itemQuery, setItemQuery] = useState<{ description?: string; status?: number }>({});
	const [itemFormOpen, setItemFormOpen] = useState(false);
	const [itemFormMode, setItemFormMode] = useState<"create" | "update">("create");
	const [editingItemId, setEditingItemId] = useState<number | null>(null);
	const { confirm, ConfirmDialog } = useConfirmDialog();

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

	const dictListItems = useMemo(() => {
		const term = queryKeyword.trim().toLowerCase();
		const list = (data || []).filter((d) => {
			if (!term) return true;
			return (
				String(d.name || "")
					.toLowerCase()
					.includes(term) ||
				String(d.code || "")
					.toLowerCase()
					.includes(term) ||
				String(d.description || "")
					.toLowerCase()
					.includes(term)
			);
		});
		return list.map((d) => {
			const canUpdate = can("system:dict:update") && !d.isSystem;
			const canDelete = can("system:dict:delete") && !d.isSystem;
			return {
				key: Number(d.id),
				title: (
					<div className="flex items-center gap-2 min-w-0">
						<span className="truncate">{d.name || "-"}</span>
						{d.isSystem ? <Badge variant="error">系统</Badge> : null}
					</div>
				),
				subtitle: [d.code, d.description].filter(Boolean).join(" · "),
				right:
					can("system:dict:update") || can("system:dict:delete") ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="ghost" size="icon" aria-label="更多">
									<Icon icon="mdi:dots-horizontal" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									disabled={!canUpdate}
									onClick={() => {
										setSelectedDict(d);
										setDictFormMode("update");
										setEditingDict(d);
										setDictFormOpen(true);
									}}
								>
									编辑
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									disabled={!canDelete}
									onClick={async () => {
										const ok = await confirm({
											title: "确认删除？",
											description: `字典：${d.name} (${d.code})`,
											confirmText: "删除",
											destructive: true,
										});
										if (!ok) return;
										try {
											await deleteDictMutation.mutateAsync([Number(d.id)]);
											setSelectedDict(null);
											toast.success("删除成功", { position: "top-center" });
										} catch {
											// handled by apiClient
										}
									}}
								>
									删除
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null,
			};
		});
	}, [can, confirm, data, deleteDictMutation.mutateAsync, queryKeyword]);

	const { data: itemData, isFetching: isItemFetching } = useQuery({
		queryKey: ["systemDictItem.page", selectedDict?.id || 0, itemPage, itemPageSize, itemQuery],
		enabled: Boolean(selectedDict?.id),
		queryFn: () =>
			systemDictItemService.page({
				dictId: Number(selectedDict?.id || 0),
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
		mutationFn: ({ id, payload }: { id: number; payload: SysDictItemSaveReq }) =>
			systemDictItemService.update(id, payload),
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

	const renderLabel = useCallback((record: SysDictItemRow) => {
		const text = record.label || "";
		const c = (record.color || "").trim();
		if (!c) return text;
		if (c === "primary") return <Badge variant="info">{text}</Badge>;
		if (c === "success") return <Badge variant="success">{text}</Badge>;
		if (c === "warning") return <Badge variant="warning">{text}</Badge>;
		if (c === "error") return <Badge variant="error">{text}</Badge>;
		if (c === "default") return <Badge variant="secondary">{text}</Badge>;
		return text;
	}, []);

	const itemColumns: Array<ColumnDef<SysDictItemRow>> = useMemo(
		() => [
			{
				header: "Label",
				accessorKey: "label",
				size: 220,
				cell: ({ row }) => renderLabel(row.original),
			},
			{ header: "Value", accessorKey: "value", size: 220 },
			{ header: "Color", accessorKey: "color", size: 120, meta: { align: "center" } },
			{ header: "Order", accessorKey: "sort", size: 90, meta: { align: "right" } },
			{
				header: "Status",
				accessorKey: "status",
				size: 110,
				meta: { align: "center" },
				cell: ({ row }) => (Number(row.original.status) === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ header: "Desc", accessorKey: "description", size: 280 },
			{ header: "Updated", accessorKey: "updateTime", size: 180 },
			{
				header: "操作",
				id: "actions",
				size: 180,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original;
					return (
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
								onClick={async () => {
									const ok = await confirm({
										title: "确认删除？",
										description: `字典项：${record.label}`,
										confirmText: "删除",
										destructive: true,
									});
									if (!ok) return;
									try {
										await deleteItemMutation.mutateAsync([Number(record.id)]);
										toast.success("删除成功", { position: "top-center" });
									} catch {
										// handled by apiClient
									}
								}}
							>
								删除
							</Button>
						</div>
					);
				},
			},
		],
		[
			can,
			confirm,
			deleteItemMutation.isPending,
			deleteItemMutation.mutateAsync,
			renderLabel,
			updateItemMutation.isPending,
		],
	);

	return (
		<>
			<SplitLayout
				leftWidth={280}
				left={
					<SystemSideCard
						title="字典"
						extra={
							can("system:dict:create") ? (
								<Button
									size="sm"
									onClick={() => {
										setDictFormMode("create");
										setEditingDict(null);
										setDictFormOpen(true);
									}}
								>
									新增
								</Button>
							) : null
						}
						toolbar={
							<>
								<Input
									value={keyword}
									onChange={(e) => setKeyword(e.target.value)}
									placeholder="Search description"
									className="w-[240px]"
								/>
								<Button size="sm" onClick={() => setQueryKeyword(keyword.trim())}>
									查询
								</Button>
								<Button
									size="sm"
									variant="secondary"
									onClick={() => {
										setKeyword("");
										setQueryKeyword("");
									}}
								>
									重置
								</Button>
							</>
						}
						contentClassName="pt-0"
					>
						{isFetching ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
						{!isFetching && (
							<SystemSideList
								items={dictListItems}
								selectedKey={selectedDict?.id ?? null}
								onSelect={(k) => {
									const id = Number(k) || 0;
									const record = (data || []).find((x) => Number(x.id) === id) || null;
									setSelectedDict(record);
									setItemPage(1);
								}}
							/>
						)}
						<DictFormDialog
							open={dictFormOpen}
							mode={dictFormMode}
							initial={editingDict}
							busy={createDictMutation.isPending || updateDictMutation.isPending}
							onOpenChange={setDictFormOpen}
							onSubmit={onSubmitDict}
						/>
					</SystemSideCard>
				}
				right={
					<Card className="min-w-0">
						<CardContent>
							<DataTable<SysDictItemRow>
								title={selectedDict ? `Items - ${selectedDict.name}` : "Items"}
								actions={
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
													const ok = await confirm({
														title: "确认清除缓存？",
														description: `字典：${selectedDict.name} (${selectedDict.code})`,
														confirmText: "清除",
														destructive: true,
													});
													if (!ok) return;
													try {
														await clearCacheMutation.mutateAsync(selectedDict.code);
														toast.success("清除成功", { position: "top-center" });
													} catch {
														// handled by apiClient
													}
												}}
											>
												清缓存
											</Button>
										)}
									</div>
								}
								search={
									<>
										<Input
											value={itemKeyword}
											onChange={(e) => setItemKeyword(e.target.value)}
											placeholder="Search description"
											className="w-[220px]"
										/>
										<Select value={itemStatus} onValueChange={setItemStatus}>
											<SelectTrigger className="w-[140px]">
												<SelectValue placeholder="状态" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">全部</SelectItem>
												<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
												<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
											</SelectContent>
										</Select>
										<Button
											disabled={!selectedDict}
											onClick={() => {
												const s = itemStatus === "all" ? undefined : Number(itemStatus);
												setItemPage(1);
												setItemQuery({
													description: itemKeyword.trim() || undefined,
													status: s !== undefined && Number.isFinite(s) ? s : undefined,
												});
											}}
										>
											查询
										</Button>
										<Button
											variant="secondary"
											onClick={() => {
												setItemKeyword("");
												setItemStatus("all");
												setItemPage(1);
												setItemQuery({});
											}}
										>
											重置
										</Button>
									</>
								}
								columns={itemColumns}
								data={itemData?.list || []}
								loading={isItemFetching}
								getRowId={(row) => String(row.id)}
								pagination={{
									page: itemPage,
									pageSize: itemPageSize,
									total: itemData?.total || 0,
									onChange: (p, s) => {
										setItemPage(p);
										setItemPageSize(s);
									},
									pageSizeOptions: [10, 20, 30, 50, 100],
								}}
								empty={
									selectedDict ? (
										<div className="text-sm text-muted-foreground">暂无数据</div>
									) : (
										<div className="text-sm text-muted-foreground">请先从左侧选择一个字典</div>
									)
								}
							/>
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
				}
			/>
			{ConfirmDialog}
		</>
	);
}
