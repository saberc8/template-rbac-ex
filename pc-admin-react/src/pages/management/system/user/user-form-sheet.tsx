import { systemDeptService, type SysDeptNode } from "@/api/services/systemDeptService";
import { systemRoleService, type SysRole } from "@/api/services/systemRoleService";
import { systemUserService, type SysUserCreateReq, type SysUserDetail, type SysUserUpdateReq } from "@/api/services/systemUserService";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import { cn } from "@/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Select, TreeSelect } from "antd";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";

type UserFormValues = {
	username: string;
	nickname: string;
	password?: string;
	gender: number;
	status: number;
	deptId: number;
	roleIds: number[];
	email?: string;
	phone?: string;
	avatar?: string;
	description?: string;
};

const passwordRule = (raw: string) => {
	const value = (raw || "").trim();
	if (value.length < 8 || value.length > 32) return false;
	const hasLetter = /[a-zA-Z]/.test(value);
	const hasDigit = /\d/.test(value);
	return hasLetter && hasDigit;
};

const deptToTreeData = (nodes: SysDeptNode[]): any[] =>
	(nodes || []).map((n) => ({
		title: n.name,
		value: n.id,
		key: n.id,
		disabled: n.status !== BasicStatus.ENABLE,
		children: deptToTreeData(n.children || []),
	}));

export type UserFormSheetProps = {
	open: boolean;
	mode: "create" | "update";
	userId?: number | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

export default function UserFormSheet({ open, mode, userId, onOpenChange, onSuccess }: UserFormSheetProps) {
	const isUpdate = mode === "update";

	const form = useForm<UserFormValues>({
		defaultValues: {
			username: "",
			nickname: "",
			password: "",
			gender: 1,
			status: BasicStatus.ENABLE,
			deptId: 0,
			roleIds: [],
			email: "",
			phone: "",
			avatar: "",
			description: "",
		},
	});

	const { data: deptTree } = useQuery({
		queryKey: ["systemDept.tree"],
		queryFn: () => systemDeptService.tree(),
		enabled: open,
	});

	const { data: roles } = useQuery({
		queryKey: ["systemRole.list"],
		queryFn: () => systemRoleService.list(),
		enabled: open,
	});

	const { data: detail, isFetching: isDetailFetching } = useQuery({
		queryKey: ["systemUser.get", userId || 0],
		queryFn: () => systemUserService.get(String(userId || 0)),
		enabled: open && isUpdate && Boolean(userId),
	});

	const createMutation = useMutation({
		mutationFn: (payload: SysUserCreateReq) => systemUserService.create(payload),
	});
	const updateMutation = useMutation({
		mutationFn: (payload: { id: number; data: SysUserUpdateReq }) => systemUserService.update(payload.id, payload.data),
	});

	useEffect(() => {
		if (!open) return;
		if (!isUpdate) {
			form.reset({
				username: "",
				nickname: "",
				password: "",
				gender: 1,
				status: BasicStatus.ENABLE,
				deptId: 0,
				roleIds: [],
				email: "",
				phone: "",
				avatar: "",
				description: "",
			});
			return;
		}
	}, [form, isUpdate, open]);

	useEffect(() => {
		if (!open || !isUpdate) return;
		if (!detail) return;
		const d: SysUserDetail = detail;
		form.reset({
			username: d.username || "",
			nickname: d.nickname || "",
			password: "",
			gender: d.gender ?? 1,
			status: d.status ?? BasicStatus.ENABLE,
			deptId: d.deptId ?? 0,
			roleIds: d.roleIds || [],
			email: d.email || "",
			phone: d.phone || "",
			avatar: d.avatar || "",
			description: d.description || "",
		});
	}, [detail, form, isUpdate, open]);

	const deptOptions = useMemo(() => deptToTreeData(deptTree || []), [deptTree]);
	const roleOptions = useMemo(() => (roles || []).map((r: SysRole) => ({ label: `${r.name} (${r.code})`, value: r.id })), [roles]);

	const title = isUpdate ? "修改用户" : "新增用户";

	const onSubmit = form.handleSubmit(async (values) => {
		const username = values.username.trim();
		const nickname = values.nickname.trim();
		if (!username || !nickname) {
			toast.error("用户名和昵称不能为空", { position: "top-center" });
			return;
		}
		if (!values.deptId) {
			toast.error("所属部门不能为空", { position: "top-center" });
			return;
		}
		if (!values.roleIds?.length) {
			toast.error("角色不能为空", { position: "top-center" });
			return;
		}
		if (!isUpdate) {
			const pwd = (values.password || "").trim();
			if (!pwd) {
				toast.error("密码不能为空", { position: "top-center" });
				return;
			}
			if (!passwordRule(pwd)) {
				toast.error("密码长度为 8-32 个字符，至少包含字母和数字", { position: "top-center" });
				return;
			}
		}

		try {
			if (!isUpdate) {
				await createMutation.mutateAsync({
					username,
					nickname,
					password: (values.password || "").trim(),
					gender: Number(values.gender) || 0,
					status: Number(values.status) || BasicStatus.ENABLE,
					deptId: Number(values.deptId) || 0,
					roleIds: values.roleIds || [],
					email: values.email?.trim() || undefined,
					phone: values.phone?.trim() || undefined,
					avatar: values.avatar?.trim() || undefined,
					description: values.description?.trim() || undefined,
				});
				toast.success("新增成功", { position: "top-center" });
			} else {
				if (!userId) {
					toast.error("缺少用户ID", { position: "top-center" });
					return;
				}
				await updateMutation.mutateAsync({
					id: userId,
					data: {
						username,
						nickname,
						gender: Number(values.gender) || 0,
						status: Number(values.status) || BasicStatus.ENABLE,
						deptId: Number(values.deptId) || 0,
						roleIds: values.roleIds || [],
						email: values.email?.trim() || undefined,
						phone: values.phone?.trim() || undefined,
						avatar: values.avatar?.trim() || undefined,
						description: values.description?.trim() || undefined,
					},
				});
				toast.success("修改成功", { position: "top-center" });
			}
			onSuccess();
			onOpenChange(false);
		} catch {
			// toast handled by apiClient interceptor
		}
	});

	const busy = createMutation.isPending || updateMutation.isPending || isDetailFetching;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0 flex flex-col">
				<SheetHeader className="p-4 border-b">
					<SheetTitle>{title}</SheetTitle>
				</SheetHeader>
				<div className="p-4 flex-1 overflow-auto">
					<form onSubmit={onSubmit} className="space-y-4">
						<div className="grid grid-cols-1 gap-2">
							<Label>用户名</Label>
							<Input {...form.register("username")} placeholder="username" />
						</div>
						<div className="grid grid-cols-1 gap-2">
							<Label>昵称</Label>
							<Input {...form.register("nickname")} placeholder="nickname" />
						</div>
						{!isUpdate && (
							<div className="grid grid-cols-1 gap-2">
								<Label>密码</Label>
								<Input type="password" {...form.register("password")} placeholder="8-32位，字母+数字" />
							</div>
						)}

						<div className="grid grid-cols-1 gap-2">
							<Label>邮箱</Label>
							<Input {...form.register("email")} placeholder="email" />
						</div>
						<div className="grid grid-cols-1 gap-2">
							<Label>手机号码</Label>
							<Input {...form.register("phone")} placeholder="phone" />
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="grid grid-cols-1 gap-2">
								<Label>性别</Label>
								<Select
									getPopupContainer={(triggerNode) => triggerNode?.parentElement || document.body}
									value={form.watch("gender")}
									onChange={(v) => form.setValue("gender", Number(v))}
									options={[
										{ label: "未知", value: 0 },
										{ label: "男", value: 1 },
										{ label: "女", value: 2 },
									]}
								/>
							</div>
							<div className="grid grid-cols-1 gap-2">
								<Label>状态</Label>
								<div className="flex items-center gap-2">
									<Switch checked={form.watch("status") === BasicStatus.ENABLE} onCheckedChange={(checked) => form.setValue("status", checked ? BasicStatus.ENABLE : BasicStatus.DISABLE)} />
									<span className="text-sm text-muted-foreground">{form.watch("status") === BasicStatus.ENABLE ? "启用" : "禁用"}</span>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-2">
							<Label>所属部门</Label>
							<TreeSelect
								className={cn("w-full")}
								treeData={deptOptions}
								value={form.watch("deptId") || undefined}
								placeholder="请选择部门"
								treeDefaultExpandAll
								allowClear
								getPopupContainer={(triggerNode) => triggerNode?.parentElement || document.body}
								onChange={(v) => form.setValue("deptId", Number(v) || 0)}
							/>
						</div>

						<div className="grid grid-cols-1 gap-2">
							<Label>角色</Label>
							<Select
								getPopupContainer={(triggerNode) => triggerNode?.parentElement || document.body}
								mode="multiple"
								value={form.watch("roleIds")}
								options={roleOptions}
								placeholder="请选择角色"
								onChange={(v) => form.setValue("roleIds", (v || []).map((x) => Number(x)))}
							/>
						</div>

						<div className="grid grid-cols-1 gap-2">
							<Label>描述</Label>
							<Textarea {...form.register("description")} placeholder="description" />
						</div>
					</form>
				</div>
				<SheetFooter className="p-4 border-t flex gap-2">
					<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={busy} onClick={onSubmit}>
						保存
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
