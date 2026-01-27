import { systemClientService, type SysClientRow } from "@/api/services/systemClientService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function ClientPage() {
	const [clientType, setClientType] = useState("");
	const [authType, setAuthType] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [query, setQuery] = useState<{ clientType?: string; authType?: string[]; status?: number }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemClient.page", page, pageSize, query],
		queryFn: () =>
			systemClientService.page({
				page,
				size: pageSize,
				clientType: query.clientType,
				authType: query.authType,
				status: query.status,
			}),
	});

	const columns: ColumnsType<SysClientRow> = useMemo(
		() => [
			{ title: "ClientId", dataIndex: "clientId", width: 220, ellipsis: true },
			{ title: "Type", dataIndex: "clientType", width: 120 },
			{
				title: "AuthType",
				dataIndex: "authType",
				width: 220,
				render: (v: string[]) => (Array.isArray(v) ? v.join(",") : ""),
			},
			{ title: "ActiveTimeout", dataIndex: "activeTimeout", width: 130 },
			{ title: "Timeout", dataIndex: "timeout", width: 110 },
			{ title: "Status", dataIndex: "status", width: 80 },
			{ title: "Created", dataIndex: "createTime", width: 180 },
			{ title: "Updated", dataIndex: "updateTime", width: 180 },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Client</div>
					<div className="flex flex-wrap items-center gap-2">
						<Input value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="ClientType" className="w-[160px]" />
						<Input
							value={authType}
							onChange={(e) => setAuthType(e.target.value)}
							placeholder="AuthType (comma separated)"
							className="w-[220px]"
						/>
						<Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" className="w-[110px]" />
						<Button
							onClick={() => {
								const s = Number(status.trim());
								const auth = authType
									.split(",")
									.map((x) => x.trim())
									.filter(Boolean);
								setPage(1);
								setQuery({
									clientType: clientType.trim() || undefined,
									authType: auth.length ? auth : undefined,
									status: Number.isFinite(s) && s >= 0 ? s : undefined,
								});
							}}
						>
							Search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysClientRow>
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

