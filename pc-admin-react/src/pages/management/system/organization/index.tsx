import { systemDeptService, type SysDeptNode } from "@/api/services/systemDeptService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { BasicStatus } from "#/enum";

export default function OrganizationPage() {
	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");

	const { data, isFetching } = useQuery({
		queryKey: ["systemDept.tree", queryKeyword],
		queryFn: () => systemDeptService.tree({ description: queryKeyword || undefined }),
	});

	const columns: ColumnsType<SysDeptNode> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 260 },
			{ title: "Sort", dataIndex: "sort", width: 80 },
			{
				title: "Status",
				dataIndex: "status",
				width: 120,
				render: (v: number) => (v === BasicStatus.DISABLE ? "Disable" : "Enable"),
			},
			{ title: "Description", dataIndex: "description" },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Organization</div>
					<div className="flex items-center gap-2">
						<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search" className="w-[240px]" />
						<Button onClick={() => setQueryKeyword(keyword.trim())}>Search</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysDeptNode>
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

