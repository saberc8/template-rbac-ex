import { systemFileService, type SysFileRow } from "@/api/services/systemFileService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function FilePage() {
	const [originalName, setOriginalName] = useState("");
	const [parentPath, setParentPath] = useState("");
	const [type, setType] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [query, setQuery] = useState<{ originalName?: string; parentPath?: string; type?: number }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemFile.page", page, pageSize, query],
		queryFn: () =>
			systemFileService.page({
				page,
				size: pageSize,
				originalName: query.originalName,
				parentPath: query.parentPath,
				type: query.type,
			}),
	});

	const columns: ColumnsType<SysFileRow> = useMemo(
		() => [
			{ title: "Name", dataIndex: "originalName", width: 260 },
			{ title: "Parent", dataIndex: "parentPath", width: 180 },
			{ title: "Type", dataIndex: "type", width: 80 },
			{ title: "Size", dataIndex: "size", width: 120 },
			{
				title: "URL",
				dataIndex: "url",
				render: (v: string) =>
					v ? (
						<a href={v} target="_blank" rel="noreferrer">
							Open
						</a>
					) : (
						"-"
					),
			},
			{ title: "Storage", dataIndex: "storageName", width: 140 },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>File</div>
					<div className="flex items-center gap-2">
						<Input value={originalName} onChange={(e) => setOriginalName(e.target.value)} placeholder="Original name" className="w-[220px]" />
						<Input value={parentPath} onChange={(e) => setParentPath(e.target.value)} placeholder="Parent path (/)" className="w-[180px]" />
						<Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="w-[90px]" />
						<Button
							onClick={() => {
								const t = Number(type.trim());
								setPage(1);
								setQuery({
									originalName: originalName.trim() || undefined,
									parentPath: parentPath.trim() || undefined,
									type: Number.isFinite(t) && t > 0 ? t : undefined,
								});
							}}
						>
							Search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysFileRow>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isFetching}
					pagination={{
						current: page,
						pageSize,
						total: data?.total || 0,
						showSizeChanger: true,
						onChange: (p, s) => {
							setPage(p);
							setPageSize(s);
						},
					}}
					columns={columns}
					dataSource={data?.list || []}
				/>
			</CardContent>
		</Card>
	);
}

