import { systemOnlineService, type OnlineUserRow } from "@/api/services/systemOnlineService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function OnlineUserPage() {
	const [nickname, setNickname] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [query, setQuery] = useState<{ nickname?: string }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["monitor.online.page", page, pageSize, query],
		queryFn: () =>
			systemOnlineService.page({
				page,
				size: pageSize,
				nickname: query.nickname,
			}),
	});

	const columns: ColumnsType<OnlineUserRow> = useMemo(
		() => [
			{ title: "Username", dataIndex: "username", width: 140 },
			{ title: "Nickname", dataIndex: "nickname", width: 160 },
			{ title: "Client", dataIndex: "clientType", width: 90 },
			{ title: "ClientId", dataIndex: "clientId", width: 160, ellipsis: true },
			{ title: "IP", dataIndex: "ip", width: 140 },
			{ title: "Browser", dataIndex: "browser", width: 220, ellipsis: true },
			{ title: "LoginTime", dataIndex: "loginTime", width: 180 },
			{ title: "LastActive", dataIndex: "lastActiveTime", width: 180 },
			{ title: "Token", dataIndex: "token", ellipsis: true },
		],
		[],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Online</div>
					<div className="flex items-center gap-2">
						<Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname / Username" className="w-[240px]" />
						<Button
							onClick={() => {
								setPage(1);
								setQuery({ nickname: nickname.trim() || undefined });
							}}
						>
							Search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<OnlineUserRow>
					rowKey="token"
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

