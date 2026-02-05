// 系统管理-文件管理页面：对齐 Vue3（左侧类型/统计 + 右侧目录/类型双模式）。

import FileAside from "./FileAside";
import FileMain from "./FileMain";
import { useSearchParams } from "@/routes/hooks";

export default function FilePage() {
	const searchParams = useSearchParams();
	const typeVal = Number(searchParams.get("type") || "0");
	const fileType = Number.isFinite(typeVal) && typeVal >= 0 ? typeVal : 0;

	return (
		<div className="flex gap-4 h-full min-h-0">
			<div className="w-[280px] shrink-0 space-y-3">
				<FileAside fileType={fileType} />
			</div>
			<div className="flex-1 min-w-0">
				<FileMain fileType={fileType} />
			</div>
		</div>
	);
}

