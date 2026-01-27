import { systemDictService, type SysDict } from "@/api/services/systemDictService";
import { systemDictItemService, type SysDictItemRow } from "@/api/services/systemDictItemService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { BasicStatus } from "#/enum";

export default function DictPage() {
	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [selectedDict, setSelectedDict] = useState<SysDict | null>(null);

	const [itemKeyword, setItemKeyword] = useState("");
	const [itemStatus, setItemStatus] = useState("");
	const [itemPage, setItemPage] = useState(1);
	const [itemPageSize, setItemPageSize] = useState(30);
	const [itemQuery, setItemQuery] = useState<{ description?: string; status?: number }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemDict.list", queryKeyword],
		queryFn: () => systemDictService.list(queryKeyword || undefined),
	});

	const columns: ColumnsType<SysDict> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 220 },
			{ title: "Code", dataIndex: "code", width: 220 },
			{ title: "Description", dataIndex: "description" },
			{
				title: "System",
				dataIndex: "isSystem",
				width: 120,
				render: (v: boolean) => (v ? "Yes" : "No"),
			},
		],
		[],
	);

	const { data: itemData, isFetching: isItemFetching } = useQuery({
		queryKey: ["systemDictItem.page", selectedDict?.id || 0, itemPage, itemPageSize, itemQuery],
		enabled: Boolean(selectedDict?.id),
		queryFn: () =>
			systemDictItemService.page({
				dictId: selectedDict!.id,
				page: itemPage,
				size: itemPageSize,
				description: itemQuery.description,
				status: itemQuery.status,
			}),
	});

	const itemColumns: ColumnsType<SysDictItemRow> = useMemo(
		() => [
			{ title: "Label", dataIndex: "label", width: 220 },
			{ title: "Value", dataIndex: "value", width: 220 },
			{ title: "Color", dataIndex: "color", width: 120 },
			{ title: "Order", dataIndex: "sort", width: 90 },
			{
				title: "Status",
				dataIndex: "status",
				width: 110,
				render: (v: number) => (v === BasicStatus.DISABLE ? "Disable" : "Enable"),
			},
			{ title: "Desc", dataIndex: "description", width: 260, ellipsis: true },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
		],
		[],
	);

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>Dict</div>
						<div className="flex items-center gap-2">
							<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search description" className="w-[240px]" />
							<Button
								onClick={() => {
									setQueryKeyword(keyword.trim());
								}}
							>
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<SysDict>
						rowKey="id"
						size="small"
						scroll={{ x: "max-content" }}
						pagination={false}
						loading={isFetching}
						columns={columns}
						dataSource={data || []}
						onRow={(record) => ({
							onClick: () => {
								setSelectedDict(record);
								setItemPage(1);
							},
						})}
						rowClassName={(record) => (record.id === selectedDict?.id ? "bg-muted/50" : "")}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="truncate">{selectedDict ? `Items - ${selectedDict.name}` : "Items"}</div>
						<div className="flex flex-wrap items-center gap-2">
							<Input value={itemKeyword} onChange={(e) => setItemKeyword(e.target.value)} placeholder="Search description" className="w-[200px]" />
							<Input value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} placeholder="Status(0/1)" className="w-[110px]" />
							<Button
								disabled={!selectedDict}
								onClick={() => {
									const s = Number(itemStatus.trim());
									setItemPage(1);
									setItemQuery({
										description: itemKeyword.trim() || undefined,
										status: Number.isFinite(s) ? s : undefined,
									});
								}}
							>
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<SysDictItemRow>
						rowKey="id"
						size="small"
						scroll={{ x: "max-content" }}
						loading={isItemFetching}
						columns={itemColumns}
						dataSource={itemData?.list || []}
						pagination={{
							current: itemPage,
							pageSize: itemPageSize,
							total: itemData?.total || 0,
							showSizeChanger: true,
							onChange: (p, s) => {
								setItemPage(p);
								setItemPageSize(s);
							},
						}}
					/>
					{!selectedDict && <div className="mt-3 text-sm text-muted-foreground">请先从左侧选择一个字典</div>}
				</CardContent>
			</Card>
		</div>
	);
}
