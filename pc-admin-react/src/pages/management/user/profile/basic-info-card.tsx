import { userProfileService } from "@/api/services/userProfileService";
import { Icon } from "@/components/icon";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Descriptions, Upload } from "antd";
import type { UploadProps } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { resolveAssetUrl } from "@/utils/asset-url";

import AvatarCropModal from "./avatar-crop-modal";
import BasicInfoUpdateModal from "./basic-info-update-modal";

export default function BasicInfoCard() {
	const userInfo = useUserInfo();
	const { updateUserInfo } = useUserActions();

	const [editOpen, setEditOpen] = useState(false);
	const [cropOpen, setCropOpen] = useState(false);
	const [cropSrc, setCropSrc] = useState("");
	const [cropFileName, setCropFileName] = useState("avatar.png");

	const avatarSrc = useMemo(() => resolveAssetUrl(userInfo.avatar || ""), [userInfo.avatar]);
	const displayName = userInfo.nickname || userInfo.username || "";
	const gender = userInfo.gender ?? 0;
	const genderIcon = useMemo(() => {
		if (gender === 1) return <Icon icon="solar:male-bold" size={16} className="ml-2 text-sky-500" />;
		if (gender === 2) return <Icon icon="solar:female-bold" size={16} className="ml-2 text-pink-500" />;
		return null;
	}, [gender]);

	const uploadMutation = useMutation({
		mutationFn: async ({ blob, fileName }: { blob: Blob; fileName: string }) => userProfileService.uploadAvatar(blob, fileName),
		onSuccess: (resp) => {
			updateUserInfo({ avatar: resp.avatar });
			toast.success("更新成功", { position: "top-center" });
		},
	});

	const uploadProps: UploadProps = useMemo(
		() => ({
			accept: "image/*",
			showUploadList: false,
			beforeUpload: async (file) => {
				setCropFileName(file.name);
				setCropSrc(URL.createObjectURL(file));
				setCropOpen(true);
				return false;
			},
		}),
		[],
	);

	const roleNames = useMemo(() => (userInfo.roles || []).map((r) => r.name || r.code).filter(Boolean).join("，"), [userInfo.roles]);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>基本信息</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col items-center gap-4">
					<Upload {...uploadProps}>
						<div className="relative">
							<div className="h-[100px] w-[100px] rounded-full overflow-hidden bg-muted flex items-center justify-center">
								{avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : <Icon icon="solar:user-bold" size={40} />}
							</div>
							<div className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow">
								<Icon icon="solar:camera-bold" size={16} />
							</div>
						</div>
					</Upload>

					<div className="flex items-center gap-2 text-lg font-semibold">
						<span>{displayName}</span>
						<Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label="修改基本信息">
							<Icon icon="solar:pen-bold" size={18} />
						</Button>
					</div>

					<div className="flex items-center gap-2 text-text-secondary">
						<Icon icon="solar:id-card-bold" size={16} />
						<span>{userInfo.id}</span>
					</div>

					<div className="w-full">
						<Descriptions column={1} size="small">
							<Descriptions.Item label="用户名">
								<span>{userInfo.username}</span>
								{genderIcon}
							</Descriptions.Item>
							<Descriptions.Item label="手机">{userInfo.phone || "暂无"}</Descriptions.Item>
							<Descriptions.Item label="邮箱">{userInfo.email || "暂无"}</Descriptions.Item>
							<Descriptions.Item label="部门">{userInfo.deptName || "暂无"}</Descriptions.Item>
							<Descriptions.Item label="角色">{roleNames || "暂无"}</Descriptions.Item>
						</Descriptions>
					</div>

					<div className="w-full text-sm text-text-secondary text-right">注册于 {userInfo.registrationDate || "-"}</div>
				</div>
			</CardContent>

			<BasicInfoUpdateModal open={editOpen} onClose={() => setEditOpen(false)} />

			<AvatarCropModal
				open={cropOpen}
				imageSrc={cropSrc}
				fileName={cropFileName}
				confirmLoading={uploadMutation.isPending}
				onCancel={() => {
					if (cropSrc) URL.revokeObjectURL(cropSrc);
					setCropSrc("");
					setCropOpen(false);
				}}
				onConfirm={(blob, fileName) => {
					uploadMutation.mutate({ blob, fileName });
					if (cropSrc) URL.revokeObjectURL(cropSrc);
					setCropSrc("");
					setCropOpen(false);
				}}
			/>
		</Card>
	);
}
