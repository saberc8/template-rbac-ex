import { userProfileService } from "@/api/services/userProfileService";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { Modal, Form, Input, Radio } from "antd";
import { useEffect } from "react";
import { toast } from "sonner";

type Props = {
	open: boolean;
	onClose: () => void;
};

type FormValues = {
	nickname: string;
	gender: number;
};

export default function BasicInfoUpdateModal({ open, onClose }: Props) {
	const userInfo = useUserInfo();
	const { refreshUserInfo } = useUserActions();
	const [form] = Form.useForm<FormValues>();

	useEffect(() => {
		if (!open) return;
		form.setFieldsValue({
			nickname: userInfo.nickname || "",
			gender: userInfo.gender ?? 0,
		});
	}, [form, open, userInfo.gender, userInfo.nickname]);

	return (
		<Modal
			title="修改基本信息"
			open={open}
			okText="保存"
			cancelText="取消"
			maskClosable={false}
			onCancel={onClose}
			onOk={async () => {
				const values = await form.validateFields();
				await userProfileService.updateBasicInfo(values);
				await refreshUserInfo();
				toast.success("修改成功", { position: "top-center" });
				onClose();
			}}
		>
			<Form form={form} layout="vertical">
				<Form.Item name="nickname" label="昵称" rules={[{ required: true, message: "请输入昵称" }]}>
					<Input placeholder="请输入昵称" />
				</Form.Item>
				<Form.Item name="gender" label="性别" rules={[{ required: true, message: "请选择性别" }]}>
					<Radio.Group
						options={[
							{ label: "男", value: 1 },
							{ label: "女", value: 2 },
							{ label: "未知", value: 0, disabled: true },
						]}
					/>
				</Form.Item>
			</Form>
		</Modal>
	);
}

