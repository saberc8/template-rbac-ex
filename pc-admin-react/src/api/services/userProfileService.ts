import apiClient from "../apiClient";

export type UploadAvatarResp = {
	avatar: string;
};

export type UpdateBasicInfoReq = {
	nickname: string;
	gender: number;
};

export type UpdatePhoneReq = {
	phone: string;
	oldPassword: string;
};

export type UpdateEmailReq = {
	email: string;
	oldPassword: string;
};

export type UpdatePasswordReq = {
	oldPassword: string;
	newPassword: string;
};

export const userProfileService = {
	uploadAvatar: (file: File | Blob, fileName?: string) => {
		const formData = new FormData();
		const name = file instanceof File ? file.name : fileName || "avatar.png";
		formData.append("avatarFile", file, name);
		return apiClient.request<UploadAvatarResp>({
			method: "PATCH",
			url: "/user/profile/avatar",
			data: formData,
		});
	},
	updateBasicInfo: (data: UpdateBasicInfoReq) => apiClient.put({ url: "/user/profile/basic/info", data }),
	updatePhone: (data: UpdatePhoneReq) => apiClient.put({ url: "/user/profile/phone", data }),
	updateEmail: (data: UpdateEmailReq) => apiClient.put({ url: "/user/profile/email", data }),
	updatePassword: (data: UpdatePasswordReq) => apiClient.put({ url: "/user/profile/password", data }),
};
