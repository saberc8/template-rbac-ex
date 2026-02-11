// 文件管理-左侧栏：统一为 SystemSideCard + SystemSideList，收敛与其他 system 页一致的左侧面板 UI。

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { systemFileService } from "@/api/services/systemFileService";
import { Icon } from "@/components/icon";
import { FileTypeList, fileTypeName } from "@/constants/file";
import { useRouter } from "@/routes/hooks/use-router";
import { fBytes } from "@/utils/format-number";
import SystemSideCard from "../components/system-side-card";
import type { SystemSideListItem } from "../components/system-side-list";
import SystemSideList from "../components/system-side-list";

export default function FileAside({ fileType }: { fileType: number }) {
	const location = useLocation();
	const router = useRouter();

	const { data: stats } = useQuery({
		queryKey: ["systemFile.statistics"],
		queryFn: () => systemFileService.statistics(),
	});

	const onSelectType = (nextType: string) => {
		const sp = new URLSearchParams(location.search);
		sp.set("type", nextType);
		router.replace(`${location.pathname}?${sp.toString()}`);
	};

	const dist = Array.isArray(stats?.data) ? stats!.data! : [];

	const listItems: SystemSideListItem[] = [
		{ key: "section:type", title: "文件类型", disabled: true },
		...FileTypeList.map((it) => ({
			key: String(it.value),
			title: (
				<div className="flex items-center gap-2 min-w-0">
					<Icon icon={it.icon} size={18} />
					<span className="truncate">{it.name}</span>
				</div>
			),
			depth: 1,
		})),
		{ key: "section:stats", title: "占用统计", disabled: true },
		{
			key: "stats:size",
			title: "存储量",
			subtitle: fBytes(stats?.size || 0),
			disabled: true,
		},
		{
			key: "stats:number",
			title: "数量",
			subtitle: String(stats?.number || 0),
			disabled: true,
		},
		...dist.map((x) => ({
			key: `stats:type:${x.type}`,
			title: fileTypeName(x.type),
			subtitle: `${x.number} · ${fBytes(x.size)}`,
			disabled: true,
			depth: 1,
		})),
	];

	return (
		<SystemSideCard title="文件管理" contentClassName="pt-0">
			<SystemSideList
				items={listItems}
				selectedKey={String(fileType || 0)}
				onSelect={(key) => {
					const k = String(key);
					if (!k || k.startsWith("section:") || k.startsWith("stats:")) return;
					onSelectType(k);
				}}
			/>
		</SystemSideCard>
	);
}
