// 系统管理-文件管理页面：对齐 Vue3（左侧类型/统计 + 右侧目录/类型双模式）。

import SplitLayout from "@/components/layout/split-layout";
import { useSearchParams } from "@/routes/hooks";
import FileAside from "./FileAside";
import FileMain from "./FileMain";

export default function FilePage() {
	const searchParams = useSearchParams();
	const typeVal = Number(searchParams.get("type") || "0");
	const fileType = Number.isFinite(typeVal) && typeVal >= 0 ? typeVal : 0;

	return (
		<SplitLayout
			leftWidth={240}
			className="h-full min-h-0"
			left={
				<div className="min-h-0">
					<FileAside fileType={fileType} />
				</div>
			}
			right={
				<div className="min-h-0">
					<FileMain fileType={fileType} />
				</div>
			}
		/>
	);
}
