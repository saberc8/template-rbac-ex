import { systemOptionService, type SysOption } from "@/api/services/systemOptionService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function OptionPage() {
	const [category, setCategory] = useState("");
	const [code, setCode] = useState("");
	const [query, setQuery] = useState<{ category?: string; code?: string[] }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemOption.list", query],
		queryFn: () => systemOptionService.list(query),
	});

	const columns: ColumnsType<SysOption> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 240 },
			{ title: "Code", dataIndex: "code", width: 240 },
			{ title: "Value", dataIndex: "value", width: 260 },
			{ title: "Description", dataIndex: "description" },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Option</div>
					<div className="flex items-center gap-2">
						<Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-[160px]" />
						<Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (comma separated)" className="w-[240px]" />
						<Button
							onClick={() => {
								const categoryVal = category.trim();
								const codes = code
									.split(",")
									.map((x) => x.trim())
									.filter(Boolean);
								setQuery({
									category: categoryVal || undefined,
									code: codes.length ? codes : undefined,
								});
							}}
						>
							Search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysOption>
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

