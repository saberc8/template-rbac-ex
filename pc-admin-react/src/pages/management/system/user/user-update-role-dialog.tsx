import { systemRoleService, type SysRole } from "@/api/services/systemRoleService";
import { systemUserService } from "@/api/services/systemUserService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type UserUpdateRoleDialogProps = {
	open: boolean;
	userId: number | null;
	defaultRoleIds?: number[];
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

export default function UserUpdateRoleDialog({ open, userId, defaultRoleIds, onOpenChange, onSuccess }: UserUpdateRoleDialogProps) {
	const [roleIds, setRoleIds] = useState<number[]>(defaultRoleIds || []);

	useEffect(() => {
		if (!open) return;
		setRoleIds(defaultRoleIds || []);
	}, [defaultRoleIds, open]);

	const { data: roles } = useQuery({
		queryKey: ["systemRole.list"],
		queryFn: () => systemRoleService.list(),
		enabled: open,
	});

	const roleOptions = useMemo(() => (roles || []).map((r: SysRole) => ({ label: `${r.name} (${r.code})`, value: r.id })), [roles]);

	const mutation = useMutation({
		mutationFn: async () => {
			if (!userId) throw new Error("missing userId");
			return systemUserService.updateRole(userId, roleIds);
		},
	});

	const onSubmit = async () => {
		if (!userId) return;
		if (!roleIds.length) {
			toast.error("角色不能为空", { position: "top-center" });
			return;
		}
		try {
			await mutation.mutateAsync();
			toast.success("分配成功", { position: "top-center" });
			onSuccess();
			onOpenChange(false);
		} catch {
			// handled by apiClient
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>分配角色</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					<Label>角色</Label>
					<Select
						mode="multiple"
						value={roleIds}
						options={roleOptions}
						placeholder="请选择角色"
						getPopupContainer={(triggerNode) => triggerNode?.parentElement || document.body}
						onChange={(v) => setRoleIds((v || []).map((x) => Number(x)))}
					/>
				</div>
				<DialogFooter>
					<Button variant="secondary" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={mutation.isPending} onClick={onSubmit}>
						确认
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
