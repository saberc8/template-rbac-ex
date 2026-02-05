// 文件管理-重命名弹窗：调用 /system/file/:id 修改 originalName。

import type { SysFileRow } from "@/api/services/systemFileService";
import { Modal } from "antd";
import { Input } from "@/ui/input";
import { useEffect, useState } from "react";

export default function FileRenameModal({
	open,
	busy,
	item,
	onOpenChange,
	onRename,
}: {
	open: boolean;
	busy: boolean;
	item: SysFileRow | null;
	onOpenChange: (open: boolean) => void;
	onRename: (name: string) => Promise<void> | void;
}) {
	const [name, setName] = useState("");

	useEffect(() => {
		if (!open) return;
		setName(item?.originalName || "");
	}, [open, item?.originalName]);

	return (
		<Modal
			open={open}
			title="重命名"
			okText="确定"
			cancelText="取消"
			confirmLoading={busy}
			onCancel={() => onOpenChange(false)}
			onOk={async () => {
				const v = name.trim();
				if (!v) return;
				await onRename(v);
			}}
		>
			<div className="space-y-2">
				<div className="text-xs text-muted-foreground">当前名称：{item?.originalName || "-"}</div>
				<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入新名称" />
			</div>
		</Modal>
	);
}

