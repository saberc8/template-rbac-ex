import apiClient from "../apiClient";

export type CaptchaResp = {
	uuid: string;
	img: string;
	expireTime?: number;
	isEnabled: boolean;
};

export const captchaService = {
	getImage: () => apiClient.get<CaptchaResp>({ url: "/captcha/image" }),
};

