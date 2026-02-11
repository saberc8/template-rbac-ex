import { TreeSelect } from "antd";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import type { SysDeptNode, SysDeptSaveReq } from "@/api/services/systemDeptService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";

const collectDescendantIds = (root: SysDeptNode | null): Set<number> => {
	const ids = new Set<number>();
	if (!root) return ids;
	const walk = (n: SysDeptNode) => {
		ids.add(Number(n.id));
		for (const ch of n.children || []) walk(ch);
	};
	walk(root);
	return ids;
};

const findNode = (nodes: SysDeptNode[], id: number): SysDeptNode | null => {
	for (const n of nodes) {
		if (Number(n.id) === Number(id)) return n;
		const found = n.children ? findNode(n.children, id) : null;
		if (found) return found;
	}
	return null;
};

type DeptFormMode = "create" | "update";

export default function DeptFormDialog({
	open,
	mode,
	tree,
	initial,
	defaultParentId,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: DeptFormMode;
	tree: SysDeptNode[];
	initial: SysDeptNode | null;
	defaultParentId?: number;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysDeptSaveReq) => Promise<void> | void;
}) {
	const [name, setName] = useState("");
	const [parentId, setParentId] = useState<number>(0);
	const [sort, setSort] = useState<number>(1);
	const [status, setStatus] = useState<number>(BasicStatus.ENABLE);
	const [description, setDescription] = useState("");

	useEffect(() => {
		if (!open) return;

		if (mode === "update" && initial) {
			setName(initial.name || "");
			setParentId(Number(initial.parentId) || 0);
			setSort(Number(initial.sort) || 1);
			setStatus(Number(initial.status) || BasicStatus.ENABLE);
			setDescription(initial.description || "");
			return;
		}

		setName("");
		setParentId(Number(defaultParentId) || 0);
		setSort(1);
		setStatus(BasicStatus.ENABLE);
		setDescription("");
	}, [defaultParentId, initial, mode, open]);

	const disabledParentIds = useMemo(() => {
		if (mode !== "update" || !initial) return new Set<number>();
		const node = findNode(tree, Number(initial.id));
		return collectDescendantIds(node);
	}, [initial, mode, tree]);

	const treeSelectData = useMemo(() => {
		const map = (nodes: SysDeptNode[]): any[] =>
			(nodes || []).map((n) => ({
				title: n.name,
				value: n.id,
				disabled: disabledParentIds.has(Number(n.id)),
				children: map(n.children || []),
			}));
		return map(tree);
	}, [disabledParentIds, tree]);

	const isSystem = Boolean(initial?.isSystem);
	const canChangeParent = !(mode === "update" && isSystem);

	const doSubmit = async () => {
		const nameVal = name.trim();
		const pid = Number(parentId) || 0;
		if (!nameVal) {
			toast.error("名称不能为空", { position: "top-center" });
			return;
		}
		if (pid <= 0) {
			toast.error("上级部门不能为空", { position: "top-center" });
			return;
		}

		const payload: SysDeptSaveReq = {
			name: nameVal,
			parentId: pid,
			sort: Number(sort) || 1,
			status: Number(status) || BasicStatus.ENABLE,
			description: description.trim(),
		};
		await onSubmit(payload);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[640px]">
				<DialogHeader>
					<DialogTitle>{mode === "create" ? "新增部门" : "编辑部门"}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="space-y-2 md:col-span-2">
						<Label>名称</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入部门名称" />
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>上级部门</Label>
						<TreeSelect
							className="w-full"
							treeData={treeSelectData}
							value={parentId}
							onChange={(v) => setParentId(Number(v) || 0)}
							placeholder="请选择上级部门"
							treeDefaultExpandAll
							disabled={!canChangeParent}
						/>
						{mode === "update" && isSystem && (
							<div className="text-xs text-muted-foreground">系统内置部门不允许变更上级部门</div>
						)}
					</div>

					<div className="space-y-2">
						<Label>排序</Label>
						<Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
					</div>

					<div className="space-y-2">
						<Label>状态</Label>
						<Select
							value={String(status)}
							onValueChange={(v) => setStatus(Number(v))}
							disabled={mode === "update" && isSystem}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
								<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
							</SelectContent>
						</Select>
						{mode === "update" && isSystem && (
							<div className="text-xs text-muted-foreground">系统内置部门不允许禁用</div>
						)}
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>描述</Label>
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={busy} onClick={doSubmit}>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
