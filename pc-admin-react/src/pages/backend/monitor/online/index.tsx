// 后端路由页面：系统监控-在线用户（对接 Go 后端 /monitor/online）。

import monitorOnlineService from "@/api/services/monitorOnlineService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useUserToken } from "@/store/userStore";
import { useQuery } from "@tanstack/react-query";
import { DatePicker, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { OnlineUserResp } from "#/system";

const { RangePicker } = DatePicker;

export default function BackendMonitorOnlinePage({ route }: { route?: BackendRouteItem }) {
	const { accessToken } = useUserToken();
	const { checkAny } = useAuthCheck("permission");
	const canKickout = checkAny(["monitor:online:kickout"]);

	const [page, setPage] = useState(1);
	const [size, setSize] = useState(10);
	const [nickname, setNickname] = useState("");
	const [loginTime, setLoginTime] = useState<[string, string] | undefined>(undefined);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["monitor.online.page", page, size, nickname, loginTime],
		queryFn: () =>
			monitorOnlineService.pageOnlineUser({
				page,
				size,
				nickname: nickname || undefined,
				loginTime: loginTime || undefined,
			}),
	});

	const columns: ColumnsType<OnlineUserResp> = [
		{ title: "用户", dataIndex: "username", width: 160 },
		{ title: "昵称", dataIndex: "nickname", width: 160 },
		{ title: "客户端", dataIndex: "clientType", width: 120 },
		{ title: "IP", dataIndex: "ip", width: 160 },
		{ title: "浏览器", dataIndex: "browser", width: 260 },
		{ title: "登录时间", dataIndex: "loginTime", width: 200 },
		{ title: "最后活跃", dataIndex: "lastActiveTime", width: 200 },
		...(canKickout
			? ([
					{
						title: "操作",
						key: "op",
						width: 140,
						render: (_: unknown, record: OnlineUserResp) => (
							<Button
								variant="outline"
								size="sm"
								disabled={!!accessToken && record.token === accessToken}
								onClick={async () => {
									if (accessToken && record.token === accessToken) {
										toast.error("不能强退自己");
										return;
									}
									const ok = window.confirm(`确认强退「${record.nickname || record.username}」？`);
									if (!ok) return;
									await monitorOnlineService.kickout(record.token);
									toast.success("已强退");
									refetch();
								}}
							>
								强退
							</Button>
						),
					},
				] as ColumnsType<OnlineUserResp>)
			: []),
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="flex flex-col">
						<div className="text-base font-semibold">在线用户</div>
						{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
					</div>
					<div className="flex items-center gap-2">
						<Input
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							placeholder="用户名/昵称"
							className="w-56"
						/>
						<RangePicker
							value={
								loginTime
									? [dayjs(loginTime[0], "YYYY-MM-DD HH:mm:ss"), dayjs(loginTime[1], "YYYY-MM-DD HH:mm:ss")]
									: undefined
							}
							showTime
							allowClear
							onChange={(v) => {
								if (!v || v.length !== 2 || !v[0] || !v[1]) {
									setLoginTime(undefined);
									return;
								}
								setLoginTime([
									v[0].format("YYYY-MM-DD HH:mm:ss"),
									v[1].format("YYYY-MM-DD HH:mm:ss"),
								]);
							}}
						/>
						<Button
							variant="outline"
							onClick={() => {
								setNickname("");
								setLoginTime(undefined);
								setPage(1);
							}}
						>
							重置
						</Button>
						<Button variant="outline" onClick={() => refetch()}>
							刷新
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<OnlineUserResp>
					rowKey={(r) => `${r.id}-${r.token}`}
					size="small"
					loading={isFetching}
					scroll={{ x: "max-content" }}
					columns={columns}
					dataSource={data?.list || []}
					pagination={{
						current: page,
						pageSize: size,
						total: data?.total || 0,
						showSizeChanger: true,
						onChange: (nextPage, nextSize) => {
							setPage(nextPage);
							setSize(nextSize);
						},
					}}
				/>
			</CardContent>
		</Card>
	);
}
