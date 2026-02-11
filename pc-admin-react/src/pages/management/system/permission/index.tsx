import { systemMenuService, type SysMenuNode, type SysMenuSaveReq } from "@/api/services/systemMenuService";
import { useUserPermissions } from "@/store/userStore";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "antd";
import Table, { type ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BasicStatus } from "#/enum";
import { toast } from "sonner";
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

export default function PermissionPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);
	const [keyword, setKeyword] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysMenuNode | null>(null);
	const [defaultParentId, setDefaultParentId] = useState<number>(0);

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
		mutationFn: ({ id, payload }: { id: number; payload: SysMenuSaveReq }) => systemMenuService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemMenu.tree"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemMenuService.delete(ids),
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
			const hit =
				(node.title || "").toLowerCase().includes(term) ||
				(node.path || "").toLowerCase().includes(term) ||
				(node.permission || "").toLowerCase().includes(term);
			const children = (node.children || [])
				.map(filterNode)
				.filter((x): x is SysMenuNode => x != null);
			if (hit || children.length > 0) {
				return { ...node, children: children.length > 0 ? children : undefined };
			}
			return null;
		};

		return stripEmptyChildren((data || []).map(filterNode).filter((x): x is SysMenuNode => x != null));
	}, [data, keyword]);

	const columns: ColumnsType<SysMenuNode> = useMemo(
		() => [
			{ title: t("sys.page.systemPermission.columns.title"), dataIndex: "title", width: 260 },
			{
				title: t("sys.page.systemPermission.columns.type"),
				dataIndex: "type",
				width: 90,
				render: (v: number) => {
					if (Number(v) === 1) return "目录";
					if (Number(v) === 2) return "菜单";
					if (Number(v) === 3) return "按钮";
					return String(v ?? "");
				},
			},
			{ title: t("sys.page.systemPermission.columns.path"), dataIndex: "path", width: 220 },
			{ title: t("sys.page.systemPermission.columns.permission"), dataIndex: "permission" },
			{
				title: t("sys.page.systemPermission.columns.status"),
				dataIndex: "status",
				width: 100,
				render: (v: number) =>
					v === BasicStatus.DISABLE
						? t("sys.page.systemPermission.status.disable")
						: t("sys.page.systemPermission.status.enable"),
			},
			{
				title: "操作",
				key: "actions",
				width: 220,
				fixed: "right",
				render: (_: any, record: SysMenuNode) => {
					const id = Number(record.id);
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
										setDefaultParentId(Number(record.parentId) || 0);
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
									onClick={() => {
										Modal.confirm({
											title: "确认删除？",
											content: "将同时删除其所有子级，并解除角色菜单关联。",
											okText: "删除",
											cancelText: "取消",
											okButtonProps: { danger: true },
											onOk: async () => {
												try {
													await deleteMutation.mutateAsync([id]);
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
							)}
						</div>
					);
				},
			},
		],
		[can, deleteMutation, t],
	);

	const onSubmitDialog = async (payload: SysMenuSaveReq) => {
		try {
			if (dialogMode === "create") {
				await createMutation.mutateAsync(payload);
				toast.success("新增成功", { position: "top-center" });
			} else if (dialogMode === "update" && editing) {
				await updateMutation.mutateAsync({ id: Number(editing.id), payload });
				toast.success("保存成功", { position: "top-center" });
			}
			setDialogOpen(false);
		} catch {
			// handled by apiClient
		}
	};
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>{t("sys.nav.system.permission")}</div>
					<div className="flex items-center gap-2">
						{can("system:menu:create") && (
							<Button
								onClick={() => {
									setDialogMode("create");
									setEditing(null);
									setDefaultParentId(0);
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
						<Input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder={t("sys.page.systemPermission.searchPlaceholder")}
							className="w-[280px]"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysMenuNode>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					pagination={false}
					loading={isFetching}
					columns={columns}
					dataSource={filteredData}
					expandable={{
						rowExpandable: (record) => (record.children?.length ?? 0) > 0,
					}}
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
			</CardContent>
		</Card>
	);
}
