// 文件管理-新建文件夹弹窗：调用 /system/file/dir 创建目录。

import { Modal } from "antd";
import { Input } from "@/ui/input";
import { useEffect, useState } from "react";

export default function CreateDirModal({
	open,
	busy,
	parentPath,
	onOpenChange,
	onCreate,
}: {
	open: boolean;
	busy: boolean;
	parentPath: string;
	onOpenChange: (open: boolean) => void;
	onCreate: (name: string) => Promise<void> | void;
}) {
	const [name, setName] = useState("");

	useEffect(() => {
		if (!open) return;
		setName("");
	}, [open]);

	return (
		<Modal
			open={open}
			title="新建文件夹"
			okText="确定"
			cancelText="取消"
			confirmLoading={busy}
			onCancel={() => onOpenChange(false)}
			onOk={async () => {
				const v = name.trim();
				if (!v) return;
				await onCreate(v);
			}}
		>
			<div className="space-y-2">
				<div className="text-xs text-muted-foreground">父目录：{parentPath}</div>
				<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入文件夹名称" />
			</div>
		</Modal>
	);
}

