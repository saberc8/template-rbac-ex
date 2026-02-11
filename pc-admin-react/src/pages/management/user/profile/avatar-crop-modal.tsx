import { Modal, Slider } from "antd";
import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { getCroppedImageBlob } from "./crop-utils";

type Props = {
	open: boolean;
	imageSrc: string;
	fileName: string;
	onCancel: () => void;
	onConfirm: (blob: Blob, fileName: string) => void;
	confirmLoading?: boolean;
};

export default function AvatarCropModal({ open, imageSrc, fileName, onCancel, onConfirm, confirmLoading }: Props) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

	const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
		setCroppedAreaPixels(croppedPixels);
	}, []);

	const canConfirm = useMemo(() => !!imageSrc && !!croppedAreaPixels, [croppedAreaPixels, imageSrc]);

	const handleOk = useCallback(async () => {
		if (!croppedAreaPixels) return;
		const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, { mimeType: "image/png" });
		onConfirm(blob, fileName || "avatar.png");
	}, [croppedAreaPixels, fileName, imageSrc, onConfirm]);

	return (
		<Modal
			title="上传头像"
			open={open}
			okText="确定"
			cancelText="取消"
			okButtonProps={{ disabled: !canConfirm }}
			onCancel={onCancel}
			onOk={handleOk}
			confirmLoading={confirmLoading}
			width={520}
			maskClosable={false}
		>
			<div className="flex flex-col gap-4">
				<div className="relative w-full h-[320px] bg-black/5 rounded-lg overflow-hidden">
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						aspect={1}
						cropShape="round"
						showGrid={false}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropComplete}
					/>
				</div>
					<div className="flex items-center gap-3">
						<div className="text-sm text-text-secondary whitespace-nowrap">缩放</div>
					<Slider min={1} max={3} step={0.05} value={zoom} onChange={(v) => setZoom(Array.isArray(v) ? v[0] : v)} />
				</div>
			</div>
		</Modal>
	);
}
