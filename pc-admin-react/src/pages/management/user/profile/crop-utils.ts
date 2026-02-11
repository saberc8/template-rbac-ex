import type { Area } from "react-easy-crop";

type CropOptions = {
	mimeType: string;
	quality?: number;
};

const createImage = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", (error) => reject(error));
		image.setAttribute("crossOrigin", "anonymous");
		image.src = url;
	});

export async function getCroppedImageBlob(imageSrc: string, crop: Area, options: CropOptions): Promise<Blob> {
	const image = await createImage(imageSrc);
	const canvas = document.createElement("canvas");
	canvas.width = crop.width;
	canvas.height = crop.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("无法创建画布上下文");

	ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((b) => resolve(b), options.mimeType, options.quality);
	});
	if (!blob) throw new Error("裁剪失败");
	return blob;
}

