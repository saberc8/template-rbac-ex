import type { SysDeptNode } from "@/api/services/systemDeptService";
import type { SysRoleDetail, SysRoleSaveReq } from "@/api/services/systemRoleService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { TreeSelect } from "antd";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RoleFormMode = "create" | "update";

const mapDeptTree = (nodes: SysDeptNode[]): any[] =>
	(nodes || []).map((n) => ({
		title: n.name,
		value: n.id,
		children: mapDeptTree(n.children || []),
	}));

export default function RoleFormDialog({
	open,
	mode,
	deptTree,
	initial,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: RoleFormMode;
	deptTree: SysDeptNode[];
	initial: SysRoleDetail | null;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysRoleSaveReq) => Promise<void> | void;
}) {
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [sort, setSort] = useState<number>(999);
	const [description, setDescription] = useState("");
	const [dataScope, setDataScope] = useState<number>(4);
	const [deptIds, setDeptIds] = useState<number[]>([]);
	const [deptCheckStrictly, setDeptCheckStrictly] = useState<boolean>(false);

	useEffect(() => {
		if (!open) return;
		if (mode === "update" && initial) {
			setName(initial.name || "");
			setCode(initial.code || "");
			setSort(Number(initial.sort) || 999);
			setDescription(initial.description || "");
			setDataScope(Number(initial.dataScope) || 4);
			setDeptIds((initial.deptIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0));
			setDeptCheckStrictly(Boolean(initial.deptCheckStrictly));
			return;
		}
		setName("");
		setCode("");
		setSort(999);
		setDescription("");
		setDataScope(4);
		setDeptIds([]);
		setDeptCheckStrictly(false);
	}, [initial, mode, open]);

	const deptSelectData = useMemo(() => mapDeptTree(deptTree || []), [deptTree]);

	const doSubmit = async () => {
		const nameVal = name.trim();
		const codeVal = code.trim();
		if (!nameVal) {
			toast.error("名称不能为空", { position: "top-center" });
			return;
		}
		if (mode === "create" && !codeVal) {
			toast.error("编码不能为空", { position: "top-center" });
			return;
		}

		const payload: SysRoleSaveReq = {
			name: nameVal,
			code: codeVal,
			sort: Number(sort) || 999,
			description: description.trim(),
			dataScope: Number(dataScope) || 4,
			deptIds: (deptIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0),
			deptCheckStrictly: Boolean(deptCheckStrictly),
		};

		await onSubmit(payload);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{mode === "create" ? "新增角色" : "编辑角色"}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>名称</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入名称" />
					</div>

					<div className="space-y-2">
						<Label>编码</Label>
						<Input
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="例如：admin"
							disabled={mode === "update"}
						/>
					</div>

					<div className="space-y-2">
						<Label>排序</Label>
						<Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
					</div>

					<div className="space-y-2">
						<Label>数据权限</Label>
						<select
							className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
							value={dataScope}
							onChange={(e) => setDataScope(Number(e.target.value))}
						>
							<option value={4}>全部数据权限</option>
							<option value={2}>本部门及以下</option>
							<option value={3}>本部门</option>
							<option value={5}>仅本人</option>
							<option value={1}>自定义</option>
						</select>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>描述</Label>
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>关联部门（可选）</Label>
						<TreeSelect
							className="w-full"
							treeData={deptSelectData}
							value={deptIds}
							onChange={(v) => setDeptIds((v || []).map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0))}
							placeholder="选择部门（多选）"
							treeDefaultExpandAll
							multiple
						/>
						<div className="mt-2 flex items-center gap-2">
							<Switch checked={deptCheckStrictly} onCheckedChange={setDeptCheckStrictly} />
							<span className="text-sm text-muted-foreground">部门勾选严格模式</span>
						</div>
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
