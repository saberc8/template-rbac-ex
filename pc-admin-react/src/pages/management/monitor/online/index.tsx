import { systemOnlineService, type OnlineUserRow } from "@/api/services/systemOnlineService";
import { useUserPermissions, useUserToken } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatePicker, Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export default function OnlineUserPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);
	const { accessToken } = useUserToken();

	const [nickname, setNickname] = useState("");
	const [loginTimeRange, setLoginTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [query, setQuery] = useState<{ nickname?: string; loginTime?: string[] }>({});

	const { data, isFetching } = useQuery({
		queryKey: ["monitor.online.page", page, pageSize, query],
		queryFn: () =>
				systemOnlineService.page({
					page,
					size: pageSize,
					nickname: query.nickname,
					loginTime: query.loginTime,
				}),
	});

	const kickoutMutation = useMutation({
		mutationFn: (token: string) => systemOnlineService.kickout(token),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["monitor.online.page"] });
		},
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
			{
				title: "操作",
				key: "actions",
				width: 120,
				fixed: "right",
				render: (_: any, record: OnlineUserRow) => {
					const isSelf = Boolean(accessToken && record.token && record.token === accessToken);
					return (
						<Button
							size="sm"
							variant="destructive"
							disabled={!can("monitor:online:kickout") || isSelf || kickoutMutation.isPending}
							onClick={() => {
								Modal.confirm({
									title: "确认强退？",
									content: isSelf ? "不能强退自己" : `用户：${record.nickname || record.username}`,
									okText: "强退",
									cancelText: "取消",
									okButtonProps: { danger: true, disabled: isSelf },
									onOk: async () => {
										try {
											await kickoutMutation.mutateAsync(record.token);
											toast.success("强退成功", { position: "top-center" });
										} catch {
											// handled by apiClient
										}
									},
								});
							}}
						>
							强退
						</Button>
					);
				},
			},
		],
		[accessToken, can, kickoutMutation.isPending],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
						<div>Online</div>
						<div className="flex items-center gap-2">
							<Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname / Username" className="w-[240px]" />
							<DatePicker.RangePicker
								value={loginTimeRange}
								onChange={(v) => {
									if (!v || !v[0] || !v[1]) {
										setLoginTimeRange(null);
										return;
									}
									setLoginTimeRange([v[0], v[1]]);
								}}
								showTime
								allowClear
							/>
							<Button
								onClick={() => {
									setPage(1);
									setQuery({
										nickname: nickname.trim() || undefined,
										loginTime: loginTimeRange
											? [loginTimeRange[0].format("YYYY-MM-DD HH:mm:ss"), loginTimeRange[1].format("YYYY-MM-DD HH:mm:ss")]
											: undefined,
									});
								}}
							>
								Search
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									setNickname("");
									setLoginTimeRange(null);
									setPage(1);
									setQuery({});
								}}
							>
								Reset
							</Button>
							<Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["monitor.online.page"] })}>
								Refresh
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
