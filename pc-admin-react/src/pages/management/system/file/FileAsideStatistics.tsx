// 文件管理-占用统计：总大小/数量 + 类型占比（对齐 Vue3 的 FileAsideStatistics）。

import { systemFileService } from "@/api/services/systemFileService";
import { Chart } from "@/components/chart";
import { FileTypeList, fileTypeName } from "@/constants/file";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Divider, Skeleton } from "antd";
import { memo, useMemo } from "react";
import { fBytes } from "@/utils/format-number";

function FileAsideStatistics() {
	const { data, isFetching } = useQuery({
		queryKey: ["systemFile.statistics"],
		queryFn: () => systemFileService.statistics(),
	});

	const totalSize = data?.size || 0;
	const totalNumber = data?.number || 0;
	const dist = Array.isArray(data?.data) ? data!.data! : [];

	const { labels, series } = useMemo(() => {
		const pairs = dist
			.filter((x) => x && typeof x.type === "number" && typeof x.number === "number")
			.map((x) => ({ type: x.type, number: x.number, size: x.size }));
		const l = pairs.map((p) => fileTypeName(p.type));
		const s = pairs.map((p) => p.number);
		return { labels: l, series: s };
	}, [dist]);

	const knownTypes = useMemo(() => new Set(FileTypeList.map((x) => x.value)), []);

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="text-base font-medium">占用</div>
			</CardHeader>
			<CardContent className="pt-0 space-y-3">
				{isFetching ? (
					<Skeleton active paragraph={{ rows: 3 }} />
				) : (
					<div className="flex items-center justify-between">
						<div className="text-center flex-1">
							<div className="text-xs text-muted-foreground">存储量</div>
							<div className="text-base font-semibold">{fBytes(totalSize)}</div>
						</div>
						<div className="w-px h-10 bg-border" />
						<div className="text-center flex-1">
							<div className="text-xs text-muted-foreground">数量</div>
							<div className="text-base font-semibold">{totalNumber}</div>
						</div>
					</div>
				)}

				{!isFetching && series.length > 0 ? (
					<div>
						<Divider className="my-3!" />
						<Chart
							type="donut"
							height={180}
							series={series}
							options={{
								labels,
								legend: { position: "bottom" },
								dataLabels: { enabled: false },
								tooltip: {
									y: {
										formatter: (v: any, opts: any) => {
											const idx = opts?.seriesIndex ?? -1;
											const item = dist[idx];
											const size = item?.size != null ? fBytes(item.size) : "";
											return `${v}${size ? `（${size}）` : ""}`;
										},
									},
								},
							}}
						/>
						<div className="mt-2 space-y-1">
							{dist.map((x) => (
								<div key={x.type} className="flex items-center justify-between text-xs text-muted-foreground">
									<span>{knownTypes.has(x.type) ? fileTypeName(x.type) : `类型${x.type}`}</span>
									<span>
										{x.number} / {fBytes(x.size)}
									</span>
								</div>
							))}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

export default memo(FileAsideStatistics);
