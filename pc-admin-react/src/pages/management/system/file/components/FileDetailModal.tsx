// 文件管理-详情弹窗：展示列表返回的文件信息（无额外接口依赖）。

import type { SysFileRow } from "@/api/services/systemFileService";
import { systemFileService } from "@/api/services/systemFileService";
import { fileTypeName } from "@/constants/file";
import { fBytes } from "@/utils/format-number";
import { Descriptions, Modal } from "antd";
import { useQuery } from "@tanstack/react-query";

export default function FileDetailModal({
	open,
	item,
	onOpenChange,
}: {
	open: boolean;
	item: SysFileRow | null;
	onOpenChange: (open: boolean) => void;
}) {
	const url = (item?.url || "").trim();
	const isDir = Number(item?.type || 0) === 0;

	const { data: dirSize } = useQuery({
		queryKey: ["systemFile.calcDirSize", item?.id],
		queryFn: () => systemFileService.calcDirSize(Number(item?.id || 0)),
		enabled: Boolean(open && isDir && item?.id),
	});

	return (
		<Modal
			open={open}
			title="文件详情"
			okText="关闭"
			cancelButtonProps={{ style: { display: "none" } }}
			onOk={() => onOpenChange(false)}
			onCancel={() => onOpenChange(false)}
			width={760}
		>
			<Descriptions column={1} size="small" bordered>
				<Descriptions.Item label="名称">{item?.originalName || "-"}</Descriptions.Item>
				<Descriptions.Item label="类型">{item ? (item.type === 0 ? "目录" : fileTypeName(item.type)) : "-"}</Descriptions.Item>
				<Descriptions.Item label="大小">{item?.size != null ? fBytes(item.size) : "-"}</Descriptions.Item>
				{isDir ? <Descriptions.Item label="目录占用">{dirSize?.size != null ? fBytes(dirSize.size) : "-"}</Descriptions.Item> : null}
				<Descriptions.Item label="父目录">{item?.parentPath || "-"}</Descriptions.Item>
				<Descriptions.Item label="路径">{item?.path || "-"}</Descriptions.Item>
				<Descriptions.Item label="扩展名">{item?.extension || "-"}</Descriptions.Item>
				<Descriptions.Item label="Content-Type">{item?.contentType || "-"}</Descriptions.Item>
				<Descriptions.Item label="存储">{item?.storageName || "-"}</Descriptions.Item>
				<Descriptions.Item label="创建时间">{item?.createTime || "-"}</Descriptions.Item>
				<Descriptions.Item label="更新时间">{item?.updateTime || "-"}</Descriptions.Item>
				<Descriptions.Item label="URL">
					{url ? (
						<a href={url} target="_blank" rel="noreferrer">
							打开链接
						</a>
					) : (
						"-"
					)}
				</Descriptions.Item>
			</Descriptions>
		</Modal>
	);
}
