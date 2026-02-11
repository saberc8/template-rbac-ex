import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import { type SysDeptNode, type SysDeptSaveReq, systemDeptService } from "@/api/services/systemDeptService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import DeptFormDialog from "./dept-form-dialog";

const stripEmptyChildren = (nodes: SysDeptNode[]): SysDeptNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

export default function OrganizationPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [queryStatus, setQueryStatus] = useState<number | undefined>(undefined);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
	const [editing, setEditing] = useState<SysDeptNode | null>(null);
	const [defaultParentId, setDefaultParentId] = useState<number>(0);
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemDept.tree", queryKeyword, queryStatus],
		queryFn: () => systemDeptService.tree({ description: queryKeyword || undefined, status: queryStatus }),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysDeptSaveReq) => systemDeptService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: SysDeptSaveReq }) => systemDeptService.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (ids: number[]) => systemDeptService.delete(ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
		},
	});
	const exportMutation = useMutation({
		mutationFn: () => systemDeptService.exportCsv({ description: queryKeyword || undefined, status: queryStatus }),
	});

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		window.URL.revokeObjectURL(url);
	};

	type FlatDeptRow = { node: SysDeptNode; depth: number; hasChildren: boolean };

	const [expandedIds, setExpandedIds] = useState<number[]>([]);

	useEffect(() => {
		const ids: number[] = [];
		const walk = (nodes: SysDeptNode[]) => {
			for (const n of nodes || []) {
				if (n.children?.length) ids.push(Number(n.id));
				if (n.children?.length) walk(n.children);
			}
		};
		walk(data || []);
		setExpandedIds(ids);
	}, [data]);

	const flatRows: FlatDeptRow[] = useMemo(() => {
		const expanded = new Set(expandedIds);
		const rows: FlatDeptRow[] = [];
		const walk = (nodes: SysDeptNode[], depth: number) => {
			for (const n of nodes || []) {
				const hasChildren = (n.children?.length ?? 0) > 0;
				rows.push({ node: n, depth, hasChildren });
				if (hasChildren && expanded.has(Number(n.id))) walk(n.children || [], depth + 1);
			}
		};
		walk(stripEmptyChildren(data || []), 0);
		return rows;
	}, [data, expandedIds]);

	const columns: Array<ColumnDef<FlatDeptRow>> = useMemo(
		() => [
			{
				header: "名称",
				id: "name",
				size: 320,
				cell: ({ row }) => {
					const r = row.original;
					const id = Number(r.node.id);
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
							<span className="truncate">{r.node.name}</span>
						</div>
					);
				},
			},
			{
				header: "排序",
				id: "sort",
				size: 80,
				meta: { align: "right" },
				cell: ({ row }) => row.original.node.sort ?? "-",
			},
			{
				header: "状态",
				id: "status",
				size: 120,
				meta: { align: "center" },
				cell: ({ row }) => (Number(row.original.node.status) === BasicStatus.DISABLE ? "禁用" : "启用"),
			},
			{ header: "描述", id: "description", size: 360, cell: ({ row }) => row.original.node.description || "-" },
			{
				header: "操作",
				id: "actions",
				size: 240,
				meta: { align: "center" },
				cell: ({ row }) => {
					const record = row.original.node;
					const id = Number(record.id);
					const hasChildren = (record.children?.length ?? 0) > 0;
					return (
						<div className="flex items-center gap-2">
							{can("system:dept:create") && (
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
							{can("system:dept:update") && (
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
							{can("system:dept:delete") && (
								<Button
									size="sm"
									variant="destructive"
									disabled={Boolean(record.isSystem) || hasChildren}
									onClick={async () => {
										const ok = await confirm({
											title: "确认删除？",
											description: hasChildren ? "存在下级部门，不允许删除。" : "删除后不可恢复。",
											confirmText: "删除",
											destructive: true,
										});
										if (!ok) return;
										try {
											await deleteMutation.mutateAsync([id]);
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
		[can, confirm, deleteMutation, expandedIds],
	);

	const onSubmitDialog = async (payload: SysDeptSaveReq) => {
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
			<CardContent>
				<DataTable<FlatDeptRow>
					title="部门管理"
					actions={
						<div className="flex flex-wrap items-center gap-2">
							{can("system:dept:create") && (
								<Button
									onClick={() => {
										const firstRootId = Number((data || [])[0]?.id) || 0;
										setDialogMode("create");
										setEditing(null);
										setDefaultParentId(firstRootId);
										setDialogOpen(true);
									}}
								>
									新增
								</Button>
							)}
							{can("system:dept:export") && (
								<Button
									variant="secondary"
									disabled={exportMutation.isPending}
									onClick={async () => {
										try {
											const blob = await exportMutation.mutateAsync();
											downloadBlob(blob, "dept_export.csv");
										} catch {
											// handled by apiClient
										}
									}}
								>
									导出
								</Button>
							)}
							<Button
								variant="secondary"
								onClick={() => {
									queryClient.invalidateQueries({ queryKey: ["systemDept.tree"] });
								}}
							>
								刷新
							</Button>
						</div>
					}
					search={
						<>
							<Input
								value={keyword}
								onChange={(e) => setKeyword(e.target.value)}
								placeholder="名称/描述"
								className="w-[220px]"
							/>
							<Select
								value={status === undefined ? "all" : String(status)}
								onValueChange={(v) => setStatus(v === "all" ? undefined : Number(v))}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="状态" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部状态</SelectItem>
									<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
									<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
								</SelectContent>
							</Select>
							<Button
								onClick={() => {
									setQueryKeyword(keyword.trim());
									setQueryStatus(status);
								}}
							>
								查询
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									setKeyword("");
									setStatus(undefined);
									setQueryKeyword("");
									setQueryStatus(undefined);
								}}
							>
								重置
							</Button>
						</>
					}
					columns={columns}
					data={flatRows}
					loading={isFetching}
					getRowId={(row) => String(row.node.id)}
				/>
				<DeptFormDialog
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
