import { systemUserService } from "@/api/services/systemUserService";
import { useRouter, useParams } from "@/routes/hooks";
import { useUserPermissions } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { check } from "@/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import UserFormSheet from "./user-form-sheet";
import UserResetPasswordDialog from "./user-reset-password-dialog";
import UserUpdateRoleDialog from "./user-update-role-dialog";

export default function UserDetail() {
	const { back } = useRouter();
	const { id } = useParams();
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const can = (code: string) => check(code, permissionCodes);

	const [editOpen, setEditOpen] = useState(false);
	const [resetPwdOpen, setResetPwdOpen] = useState(false);
	const [updateRoleOpen, setUpdateRoleOpen] = useState(false);

	const { data, isFetching } = useQuery({
		queryKey: ["systemUser.get", id],
		queryFn: () => systemUserService.get(String(id)),
		enabled: Boolean(id),
	});

	const userId = Number(id) || null;

	return (
		<Card>
			<CardContent>
				{isFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
				{!isFetching && !data && <div className="text-sm text-muted-foreground">No data</div>}
				{data && (
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<img alt="" src={data.avatar} className="h-12 w-12 rounded-full object-cover bg-muted" />
								<div>
									<div className="text-base font-medium">
										{data.nickname} <span className="text-sm text-muted-foreground">({data.username})</span>
									</div>
									<div className="text-sm text-muted-foreground">{data.deptName || "-"}</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="secondary" onClick={() => back()}>
									返回
								</Button>
								{can("system:user:update") && (
									<Button onClick={() => setEditOpen(true)}>
										修改
									</Button>
								)}
								{can("system:user:resetPwd") && (
									<Button variant="secondary" onClick={() => setResetPwdOpen(true)}>
										重置密码
									</Button>
								)}
								{can("system:user:updateRole") && (
									<Button variant="secondary" onClick={() => setUpdateRoleOpen(true)}>
										分配角色
									</Button>
								)}
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
							<div>邮箱：{data.email || "-"}</div>
							<div>手机：{data.phone || "-"}</div>
							<div>
								状态：
								<Badge className="ml-2" variant={data.status === 2 ? "error" : "success"}>
									{data.status === 2 ? "禁用" : "启用"}
								</Badge>
							</div>
							<div>创建时间：{data.createTime || "-"}</div>
						</div>

						<div className="space-y-2">
							<div className="text-sm font-medium">角色</div>
							<div className="text-sm text-muted-foreground">{(data.roleNames || []).join(", ") || "-"}</div>
						</div>

						<div className="space-y-2">
							<div className="text-sm font-medium">描述</div>
							<div className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description || "-"}</div>
						</div>
					</div>
				)}
			</CardContent>
			<UserFormSheet
				open={editOpen}
				mode="update"
				userId={userId}
				onOpenChange={setEditOpen}
				onSuccess={() => queryClient.invalidateQueries({ queryKey: ["systemUser.get", id] })}
			/>
			<UserResetPasswordDialog open={resetPwdOpen} userId={userId} onOpenChange={setResetPwdOpen} />
			<UserUpdateRoleDialog
				open={updateRoleOpen}
				userId={userId}
				defaultRoleIds={data?.roleIds}
				onOpenChange={setUpdateRoleOpen}
				onSuccess={() => queryClient.invalidateQueries({ queryKey: ["systemUser.get", id] })}
			/>
		</Card>
	);
}
