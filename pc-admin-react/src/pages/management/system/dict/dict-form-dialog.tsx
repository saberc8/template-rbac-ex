// 字典表单弹窗：对接 /system/dict（新增/编辑）

import type { SysDict, SysDictCreateReq, SysDictUpdateReq } from "@/api/services/systemDictService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DictFormMode = "create" | "update";

export default function DictFormDialog({
	open,
	mode,
	initial,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: DictFormMode;
	initial: SysDict | null;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysDictCreateReq | SysDictUpdateReq) => Promise<void> | void;
}) {
	const isUpdate = mode === "update";

	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [description, setDescription] = useState("");

	useEffect(() => {
		if (!open) return;
		if (!isUpdate) {
			setName("");
			setCode("");
			setDescription("");
			return;
		}
		if (initial) {
			setName(initial.name || "");
			setCode(initial.code || "");
			setDescription(initial.description || "");
		}
	}, [initial, isUpdate, open]);

	const title = useMemo(() => (isUpdate ? "修改字典" : "新增字典"), [isUpdate]);

	const doSubmit = async () => {
		const nameVal = name.trim();
		const codeVal = code.trim();
		if (!nameVal) {
			toast.error("名称不能为空", { position: "top-center" });
			return;
		}
		if (!isUpdate && !codeVal) {
			toast.error("编码不能为空", { position: "top-center" });
			return;
		}
		if (!isUpdate) {
			await onSubmit({ name: nameVal, code: codeVal, description: description.trim() || undefined });
		} else {
			await onSubmit({ name: nameVal, description: description.trim() || undefined });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4">
					<div className="space-y-2">
						<Label>名称</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
					</div>

					<div className="space-y-2">
						<Label>编码</Label>
						<Input value={code} onChange={(e) => setCode(e.target.value)} disabled={busy || isUpdate} placeholder={isUpdate ? "编码不允许修改" : "例如：auth_type_enum"} />
					</div>

					<div className="space-y-2">
						<Label>描述</Label>
						<Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
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

