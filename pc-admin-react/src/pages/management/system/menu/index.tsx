import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import { type SysMenuNode, type SysMenuSaveReq, systemMenuService } from "@/api/services/systemMenuService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import { GLOBAL_CONFIG } from "@/global-config";
import { useMenuStore } from "@/store/menuStore";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import MenuFormDialog from "./menu-form-dialog";

const stripEmptyChildren = (nodes: SysMenuNode[]): SysMenuNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

export default function MenuPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);
	const translateTitle = useCallback(
		(value: string) => {
			const raw = String(value || "");
			if (!raw) return raw;
			const translated = t(raw);
			return translated === raw ? raw : translated;
		},
		[t],
	);
	const [keyword, setKeyword] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysMenuNode | null>(null);
	const [defaultParentId, setDefaultParentId] = useState<string>("0");
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemMenu.tree"],
		queryFn: () => systemMenuService.tree(),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysMenuSaveReq) => systemMenuService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemMenu.tree"] });
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: string | number; payload: SysMenuSaveReq }) => systemMenuService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemMenu.tree"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: Array<string | number>) => systemMenuService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemMenu.tree"] });
		},
	});
	const clearCacheMutation = useMutation({
		mutationFn: () => systemMenuService.clearCache(),
	});

	const filteredData = useMemo(() => {
		const term = keyword.trim().toLowerCase();
		if (!term) return stripEmptyChildren(data || []);

		const filterNode = (node: SysMenuNode): SysMenuNode | null => {
			const displayTitle = translateTitle(node.title || "");
			const hit =
				(node.title || "").toLowerCase().includes(term) ||
				displayTitle.toLowerCase().includes(term) ||
				(node.path || "").toLowerCase().includes(term) ||
				(node.permission || "").toLowerCase().includes(term);
			const children = (node.children || []).map(filterNode).filter((x): x is SysMenuNode => x != null);
			if (hit || children.length > 0) {
				return { ...node, children: children.length > 0 ? children : undefined };
			}
			return null;
		};

		return stripEmptyChildren((data || []).map(filterNode).filter((x): x is SysMenuNode => x != null));
	}, [data, keyword, translateTitle]);

	type FlatMenuRow = { node: SysMenuNode; depth: number; hasChildren: boolean };

	const [expandedIds, setExpandedIds] = useState<string[]>([]);

	useEffect(() => {
		const ids: string[] = [];
		const walk = (nodes: SysMenuNode[]) => {
			for (const n of nodes || []) {
				if (n.children?.length) ids.push(String(n.id));
				if (n.children?.length) walk(n.children);
			}
		};
		walk(filteredData);
		setExpandedIds(ids);
	}, [filteredData]);

	const flatRows: FlatMenuRow[] = useMemo(() => {
		const expanded = new Set(expandedIds);
		const rows: FlatMenuRow[] = [];
		const walk = (nodes: SysMenuNode[], depth: number) => {
			for (const n of nodes || []) {
				const hasChildren = (n.children?.length ?? 0) > 0;
				rows.push({ node: n, depth, hasChildren });
				if (hasChildren && expanded.has(String(n.id))) walk(n.children || [], depth + 1);
			}
		};
		walk(filteredData, 0);
		return rows;
	}, [expandedIds, filteredData]);

	const columns: Array<ColumnDef<FlatMenuRow>> = useMemo(
		() => [
			{
				header: t("sys.page.systemPermission.columns.title"),
				id: "title",
				size: 320,
				cell: ({ row }) => {
					const r = row.original;
					const id = String(r.node.id);
					const expanded = expandedIds.includes(id);
					const indent = Math.max(0, Number(r.depth) || 0) * 16;

					return (
						<div className="flex items-center gap-2 min-w-0">
							<div className="flex items-center" style={{ width: indent }} />
							{r.hasChildren ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 shrink-0"
									onClick={(e) => {
										e.stopPropagation();
										setExpandedIds((prev) => {
											const set = new Set(prev);
											if (set.has(id)) set.delete(id);
											else set.add(id);
											return Array.from(set);
										});
									}}
									aria-label={expanded ? "collapse" : "expand"}
								>
									{expanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
								</Button>
							) : (
								<div className="h-7 w-7 shrink-0" />
							)}
							<span className="truncate">{translateTitle(r.node.title)}</span>
						</div>
					);
				},
			},
			{
				header: t("sys.page.systemPermission.columns.type"),
				id: "type",
				size: 90,
				meta: { align: "center" },
				cell: ({ row }) => {
					const v = Number(row.original.node.type);
					if (v === 1) return "目录";
					if (v === 2) return "菜单";
					if (v === 3) return "按钮";
					return String(v ?? "");
				},
			},
			{
				header: t("sys.page.systemPermission.columns.path"),
				id: "path",
				size: 220,
				cell: ({ row }) => row.original.node.path || "-",
			},
			{
				header: t("sys.page.systemPermission.columns.permission"),
				id: "permission",
				size: 260,
				cell: ({ row }) => row.original.node.permission || "-",
			},
			{
				header: t("sys.page.systemPermission.columns.status"),
				id: "status",
				size: 100,
				meta: { align: "center" },
				cell: ({ row }) =>
					Number(row.original.node.status) === BasicStatus.DISABLE
						? t("sys.page.systemPermission.status.disable")
						: t("sys.page.systemPermission.status.enable"),
			},
			{
				header: "操作",
				id: "actions",
				size: 240,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original.node;
					const id = String(record.id);
					const isSystemButton = Number(record.type) === 3;
					return (
						<div className="flex items-center gap-2">
							{can("system:menu:create") && !isSystemButton && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => {
										setDialogMode("create");
										setEditing(null);
										setDefaultParentId(id);
										setDialogOpen(true);
									}}
								>
									新增子级
								</Button>
							)}
							{can("system:menu:update") && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => {
										setDialogMode("update");
										setEditing(record);
										setDefaultParentId(String(record.parentId ?? "0"));
										setDialogOpen(true);
									}}
								>
									编辑
								</Button>
							)}
							{can("system:menu:delete") && (
								<Button
									size="sm"
									variant="destructive"
									onClick={async () => {
										const ok = await confirm({
											title: "确认删除？",
											description: "将同时删除其所有子级，并解除角色菜单关联。",
											confirmText: "删除",
											destructive: true,
										});
											if (!ok) return;
											try {
												await deleteMutation.mutateAsync([id]);
												if (GLOBAL_CONFIG.routerMode === "backend") {
													try {
														await useMenuStore.getState().actions.initBackendMenuTree();
													} catch {
														// best-effort
													}
												}
												toast.success("删除成功", { position: "top-center" });
											} catch {
												// handled by apiClient
											}
										}}
								>
									删除
								</Button>
							)}
						</div>
					);
				},
			},
		],
		[can, confirm, deleteMutation, expandedIds, t, translateTitle],
	);

	const onSubmitDialog = async (payload: SysMenuSaveReq) => {
		try {
			if (dialogMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (dialogMode === "update" && editing) {
				await updateMutation.mutateAsync({ id: String(editing.id), payload });
				toast.success("保存成功", { position: "top-center" });
			}
			if (GLOBAL_CONFIG.routerMode === "backend") {
				try {
					await useMenuStore.getState().actions.initBackendMenuTree();
				} catch {
					// best-effort: /menu 刷新失败不阻断菜单管理保存
				}
			}
			setDialogOpen(false);
		} catch {
			// handled by apiClient
		}
	};
	return (
		<Card>
			<CardContent>
				<DataTable<FlatMenuRow>
					title={t("sys.nav.system.menu")}
					actions={
						<div className="flex items-center gap-2">
							{can("system:menu:create") && (
								<Button
									onClick={() => {
										setDialogMode("create");
										setEditing(null);
										setDefaultParentId("0");
										setDialogOpen(true);
									}}
								>
									新增
								</Button>
							)}
							{can("system:menu:clearCache") && (
								<Button
									variant="secondary"
									disabled={clearCacheMutation.isPending}
									onClick={async () => {
										try {
											await clearCacheMutation.mutateAsync();
											toast.success("清除缓存成功", { position: "top-center" });
										} catch {
											// handled by apiClient
										}
									}}
								>
									清缓存
								</Button>
							)}
							<Button
								variant="secondary"
								onClick={() => {
									queryClient.invalidateQueries({ queryKey: ["systemMenu.tree"] });
								}}
							>
								刷新
							</Button>
						</div>
					}
					search={
						<Input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder={t("sys.page.systemPermission.searchPlaceholder")}
							className="w-[280px]"
						/>
					}
					columns={columns}
					data={flatRows}
					loading={isFetching}
					getRowId={(row) => String(row.node.id)}
				/>
				<MenuFormDialog
					open={dialogOpen}
					mode={dialogMode}
					tree={stripEmptyChildren(data || [])}
					initial={editing}
					defaultParentId={defaultParentId}
					busy={createMutation.isPending || updateMutation.isPending}
					onOpenChange={setDialogOpen}
					onSubmit={onSubmitDialog}
				/>
				{ConfirmDialog}
			</CardContent>
		</Card>
	);
}
