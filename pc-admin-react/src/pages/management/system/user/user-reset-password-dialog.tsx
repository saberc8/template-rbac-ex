import { systemUserService } from "@/api/services/systemUserService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const passwordRule = (raw: string) => {
	const value = (raw || "").trim();
	if (value.length < 8 || value.length > 32) return false;
	const hasLetter = /[a-zA-Z]/.test(value);
	const hasDigit = /\\d/.test(value);
	return hasLetter && hasDigit;
};

export type UserResetPasswordDialogProps = {
	open: boolean;
	userId: number | null;
	onOpenChange: (open: boolean) => void;
};

export default function UserResetPasswordDialog({ open, userId, onOpenChange }: UserResetPasswordDialogProps) {
	const [newPassword, setNewPassword] = useState("");

	useEffect(() => {
		if (!open) return;
		setNewPassword("");
	}, [open]);

	const mutation = useMutation({
		mutationFn: async () => {
			if (!userId) throw new Error("missing userId");
			return systemUserService.resetPassword(userId, newPassword.trim());
		},
	});

	const onSubmit = async () => {
		const pwd = newPassword.trim();
		if (!pwd) {
			toast.error("密码不能为空", { position: "top-center" });
			return;
		}
		if (!passwordRule(pwd)) {
			toast.error("密码长度为 8-32 个字符，至少包含字母和数字", { position: "top-center" });
			return;
		}
		try {
			await mutation.mutateAsync();
			toast.success("重置成功", { position: "top-center" });
			onOpenChange(false);
		} catch {
			// handled by apiClient
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>重置密码</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					<Label>新密码</Label>
					<Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8-32位，字母+数字" />
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

