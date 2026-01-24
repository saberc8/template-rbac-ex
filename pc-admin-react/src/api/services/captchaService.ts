import apiClient from "../apiClient";

import type { ImageCaptchaResp } from "#/backend";

export enum CaptchaApi {
	Image = "/captcha/image",
}

const getImageCaptcha = () => apiClient.get<ImageCaptchaResp>({ url: CaptchaApi.Image });

export default {
	getImageCaptcha,
};

