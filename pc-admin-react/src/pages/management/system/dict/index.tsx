import { systemDictService, type SysDict } from "@/api/services/systemDictService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function DictPage() {
	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");

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

	return (
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
				/>
			</CardContent>
		</Card>
	);
}

