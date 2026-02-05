// 文件管理-左侧栏：文件类型菜单 + 占用统计（对齐 Vue3 的 FileAside）。

import { Card, CardContent, CardHeader } from "@/ui/card";
import { FileTypeList } from "@/constants/file";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { Icon } from "@/components/icon";
import { useLocation } from "react-router";
import { useRouter } from "@/routes/hooks/use-router";
import FileAsideStatistics from "./FileAsideStatistics";

export default function FileAside({ fileType }: { fileType: number }) {
	const location = useLocation();
	const router = useRouter();

	const onClick: MenuProps["onClick"] = (e) => {
		const nextType = String(e.key);
		const sp = new URLSearchParams(location.search);
		sp.set("type", nextType);
		router.replace(`${location.pathname}?${sp.toString()}`);
	};

	const items: MenuProps["items"] = [
		{
			key: "file-type",
			label: "文件类型",
			icon: <Icon icon="solar:apps-bold-duotone" size={18} />,
			children: FileTypeList.map((it) => ({
				key: String(it.value),
				label: (
					<div className="flex items-center gap-2">
						<Icon icon={it.icon} size={18} />
						<span>{it.name}</span>
					</div>
				),
			})),
		},
	];

	return (
		<div className="space-y-3">
			<Card>
				<CardHeader className="pb-2">
					<div className="text-base font-medium">文件类型</div>
				</CardHeader>
				<CardContent className="p-2 pt-0">
					<Menu mode="inline" defaultOpenKeys={["file-type"]} selectedKeys={[String(fileType || 0)]} items={items} onClick={onClick} />
				</CardContent>
			</Card>
			<FileAsideStatistics />
		</div>
	);
}
