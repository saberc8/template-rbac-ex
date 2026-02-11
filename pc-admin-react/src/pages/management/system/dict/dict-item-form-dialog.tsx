// 字典项表单弹窗：对接 /system/dict/item（新增/编辑）

import { systemDictItemService, type SysDictItemSaveReq } from "@/api/services/systemDictItemService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BasicStatus } from "#/enum";
import { toast } from "sonner";

type DictItemFormMode = "create" | "update";

const COLOR_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "", label: "无" },
	{ value: "primary", label: "主要（蓝）" },
	{ value: "success", label: "成功（绿）" },
	{ value: "warning", label: "警告（橙）" },
	{ value: "error", label: "错误（红）" },
	{ value: "default", label: "默认（灰）" },
];

export default function DictItemFormDialog({
	open,
	mode,
	dictId,
	id,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: DictItemFormMode;
	dictId?: number | null;
	id?: number | null;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysDictItemSaveReq) => Promise<void> | void;
}) {
	const isUpdate = mode === "update";
	const enabled = open && isUpdate && Boolean(id && id > 0);

	const { data: detail, isFetching } = useQuery({
		queryKey: ["systemDictItem.get", id || 0],
		queryFn: () => systemDictItemService.get(Number(id || 0)),
		enabled,
	});

	const [label, setLabel] = useState("");
	const [value, setValue] = useState("");
	const [color, setColor] = useState("");
	const [sort, setSort] = useState<number>(999);
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<number>(BasicStatus.ENABLE);

	useEffect(() => {
		if (!open) return;
		if (!isUpdate) {
			setLabel("");
			setValue("");
			setColor("");
			setSort(999);
			setDescription("");
			setStatus(BasicStatus.ENABLE);
		}
	}, [isUpdate, open]);

	useEffect(() => {
		if (!open || !isUpdate) return;
		if (!detail) return;
		setLabel(detail.label || "");
		setValue(detail.value || "");
		setColor(detail.color || "");
		setSort(Number(detail.sort) || 999);
		setDescription(detail.description || "");
		setStatus(Number(detail.status) || BasicStatus.ENABLE);
	}, [detail, isUpdate, open]);

	const title = useMemo(() => (isUpdate ? "修改字典项" : "新增字典项"), [isUpdate]);
	const loading = Boolean(busy || isFetching);

	const doSubmit = async () => {
		const labelVal = label.trim();
		const valueVal = value.trim();
		if (!labelVal || !valueVal) {
			toast.error("标签和值不能为空", { position: "top-center" });
			return;
		}
		if (!isUpdate && (!dictId || dictId <= 0)) {
			toast.error("请先选择字典", { position: "top-center" });
			return;
		}
		await onSubmit({
			label: labelVal,
			value: valueVal,
			color: (color || "").trim() || undefined,
			sort: Number(sort) > 0 ? Number(sort) : 999,
			description: description.trim() || undefined,
			status: Number(status) || BasicStatus.ENABLE,
			dictId: dictId || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4">
					<div className="space-y-2">
						<Label>标签</Label>
						<Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} disabled={loading} />
					</div>

					<div className="space-y-2">
						<Label>值</Label>
						<Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={30} disabled={loading} />
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label>颜色</Label>
							<select className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={color} onChange={(e) => setColor(e.target.value)} disabled={loading}>
								{COLOR_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>

						<div className="space-y-2">
							<Label>排序</Label>
							<Input type="number" value={Number.isFinite(sort) ? sort : 999} onChange={(e) => setSort(e.target.value === "" ? 0 : Number(e.target.value))} disabled={loading} />
						</div>
					</div>

					<div className="space-y-2">
						<Label>描述</Label>
						<Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
					</div>

					<div className="flex items-center gap-3">
						<Switch checked={status === BasicStatus.ENABLE} onCheckedChange={(checked) => setStatus(checked ? BasicStatus.ENABLE : BasicStatus.DISABLE)} disabled={loading} />
						<span className="text-sm text-muted-foreground">{status === BasicStatus.ENABLE ? "启用" : "禁用"}</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={loading} onClick={doSubmit}>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

