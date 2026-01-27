import { systemStorageService, type SysStorageRow } from "@/api/services/systemStorageService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function StoragePage() {
	const [description, setDescription] = useState("");
	const [type, setType] = useState("");
	const [query, setQuery] = useState<{ description?: string; type?: number }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemStorage.list", query],
		queryFn: () => systemStorageService.list(query),
	});

	const columns: ColumnsType<SysStorageRow> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 240 },
			{ title: "Code", dataIndex: "code", width: 180 },
			{ title: "Type", dataIndex: "type", width: 80 },
			{
				title: "Default",
				dataIndex: "isDefault",
				width: 90,
				render: (v: boolean) => (v ? "Yes" : "No"),
			},
			{ title: "Status", dataIndex: "status", width: 80 },
			{ title: "Endpoint", dataIndex: "endpoint", width: 220, ellipsis: true },
			{ title: "Bucket", dataIndex: "bucketName", width: 160, ellipsis: true },
			{ title: "Domain", dataIndex: "domain", width: 220, ellipsis: true },
			{ title: "Desc", dataIndex: "description", width: 260, ellipsis: true },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Storage</div>
					<div className="flex items-center gap-2">
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keyword" className="w-[220px]" />
						<Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="w-[90px]" />
						<Button
							onClick={() => {
								const t = Number(type.trim());
								setQuery({
									description: description.trim() || undefined,
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
				<Table<SysStorageRow>
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

