import { userProfileService } from "@/api/services/userProfileService";
import { Icon } from "@/components/icon";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Form, Input, Modal } from "antd";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ModeType = "phone" | "email" | "password";

type FormValues = {
	phone?: string;
	email?: string;
	oldPassword: string;
	newPassword?: string;
	rePassword?: string;
};

export default function SecuritySettingsCard() {
	const userInfo = useUserInfo();
	const { refreshUserInfo } = useUserActions();

	const [open, setOpen] = useState(false);
	const [type, setType] = useState<ModeType>("phone");
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<FormValues>();

	const modeList = useMemo(() => {
		const phone = userInfo.phone || "";
		const email = userInfo.email || "";
		const pwdResetTime = userInfo.pwdResetTime || "";
		return [
			{
				type: "phone" as const,
				title: "安全手机",
				icon: "solar:phone-bold",
				value: phone,
				subtitle: `${phone ? "" : "手机号"}可用于登录、身份验证、密码找回、通知接收`,
				status: !!phone,
				statusString: phone ? "已绑定" : "未绑定",
			},
			{
				type: "email" as const,
				title: "安全邮箱",
				icon: "solar:mailbox-bold",
				value: email,
				subtitle: `${email ? "" : "邮箱"}可用于登录、身份验证、密码找回、通知接收`,
				status: !!email,
				statusString: email ? "已绑定" : "未绑定",
			},
			{
				type: "password" as const,
				title: "登录密码",
				icon: "solar:lock-password-bold",
				value: "",
				subtitle: pwdResetTime ? "为了您的账号安全，建议定期修改密码" : "请设置密码，可通过账号+密码登录",
				status: !!pwdResetTime,
				statusString: pwdResetTime ? "已设置" : "未设置",
			},
		];
	}, [userInfo.email, userInfo.phone, userInfo.pwdResetTime]);

	const openModal = (t: ModeType) => {
		setType(t);
		form.resetFields();
		form.setFieldsValue({
			phone: userInfo.phone || "",
			email: userInfo.email || "",
			oldPassword: "",
		});
		setOpen(true);
	};

	const title = type === "phone" ? "修改手机号" : type === "email" ? "修改邮箱" : "修改密码";

	const save = async () => {
		const values = await form.validateFields();
		setSaving(true);
		try {
			if (type === "phone") {
				await userProfileService.updatePhone({ phone: values.phone || "", oldPassword: values.oldPassword });
			} else if (type === "email") {
				await userProfileService.updateEmail({ email: values.email || "", oldPassword: values.oldPassword });
			} else {
				if ((values.newPassword || "") !== (values.rePassword || "")) {
					toast.error("两次新密码不一致", { position: "top-center" });
					return;
				}
				if ((values.newPassword || "") === values.oldPassword) {
					toast.error("新密码与旧密码不能相同", { position: "top-center" });
					return;
				}
				await userProfileService.updatePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword || "" });
			}
			toast.success("修改成功", { position: "top-center" });
			await refreshUserInfo();
			setOpen(false);
		} catch (e: any) {
			toast.error(e?.message || "操作失败", { position: "top-center" });
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<Card className="h-full">
				<CardHeader>
					<CardTitle>安全设置</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4">
						{modeList.map((item) => (
							<div key={item.type} className="flex items-start gap-4 p-4 rounded-lg border">
								<div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
									<Icon icon={item.icon} size={24} />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between gap-4">
										<div className="flex items-center gap-3">
											<div className="font-medium">{item.title}</div>
											<div className="flex items-center gap-1 text-xs">
												{item.status ? (
													<Icon icon="solar:check-circle-bold" size={14} className="text-emerald-600" />
												) : (
													<Icon icon="solar:danger-circle-bold" size={14} className="text-amber-600" />
												)}
												<span className={item.status ? "text-emerald-600" : "text-amber-600"}>{item.statusString}</span>
											</div>
										</div>
										<Button variant={item.status || item.type === "password" ? "secondary" : "default"} onClick={() => openModal(item.type)}>
											{item.type === "password" || item.status ? "修改" : "绑定"}
										</Button>
									</div>
									<div className="text-sm text-text-secondary mt-1">
										<span className="mr-2">{item.value || ""}</span>
										{item.subtitle}
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Modal
				title={title}
				open={open}
				okText="保存"
				cancelText="取消"
				maskClosable={false}
				confirmLoading={saving}
				onCancel={() => setOpen(false)}
				onOk={save}
			>
				<Form form={form} layout="vertical">
					{type === "phone" ? (
						<Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
							<Input placeholder="请输入手机号" />
						</Form.Item>
					) : null}
					{type === "email" ? (
						<Form.Item name="email" label="邮箱" rules={[{ required: true, message: "请输入邮箱" }]}>
							<Input placeholder="请输入邮箱" />
						</Form.Item>
					) : null}
					{type === "password" ? (
						<>
							<Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
								<Input.Password placeholder="请输入当前密码" />
							</Form.Item>
							<Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: "请输入新密码" }]}>
								<Input.Password placeholder="请输入新密码" />
							</Form.Item>
							<Form.Item name="rePassword" label="确认新密码" rules={[{ required: true, message: "请再次输入新密码" }]}>
								<Input.Password placeholder="请再次输入新密码" />
							</Form.Item>
						</>
					) : (
						<Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
							<Input.Password placeholder="请输入当前密码" />
						</Form.Item>
					)}
				</Form>
			</Modal>
		</>
	);
}
