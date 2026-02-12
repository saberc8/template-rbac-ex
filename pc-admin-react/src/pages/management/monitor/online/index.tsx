import { systemOnlineService, type OnlineUserRow } from "@/api/services/systemOnlineService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import OperationActions from "@/components/data-table/operation-actions";
import { useUserPermissions, useUserToken } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DatePicker } from "antd";
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
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const [nickname, setNickname] = useState("");
	const [loginTimeRange, setLoginTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
	const [queryNickname, setQueryNickname] = useState<string>("");
	const [queryLoginTime, setQueryLoginTime] = useState<string[] | undefined>(undefined);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);

	const { data, isFetching } = useQuery({
		queryKey: ["monitor.online.page", page, pageSize, queryNickname, queryLoginTime],
		queryFn: () =>
			systemOnlineService.page({
				page,
				size: pageSize,
				nickname: queryNickname || undefined,
				loginTime: queryLoginTime,
			}),
	});

	const kickoutMutation = useMutation({
		mutationFn: (token: string) => systemOnlineService.kickout(token),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["monitor.online.page"] });
		},
	});

	const refresh = () => queryClient.invalidateQueries({ queryKey: ["monitor.online.page"] });

	const columns: Array<ColumnDef<OnlineUserRow>> = useMemo(() => {
		const base: Array<ColumnDef<OnlineUserRow>> = [
			{
				header: "用户",
				id: "user",
				size: 220,
				cell: ({ row }) => {
					const record = row.original;
					return (
						<div className="flex flex-col">
							<span className="text-sm">{record.nickname || "-"}</span>
							<span className="text-xs text-muted-foreground">{record.username || "-"}</span>
						</div>
					);
				},
			},
			{ header: "客户端", accessorKey: "clientType", size: 110, meta: { align: "center" } },
			{
				header: "ClientId",
				accessorKey: "clientId",
				size: 200,
				cell: ({ row }) => (
					<span className="block max-w-[260px] truncate" title={row.original.clientId || ""}>
						{row.original.clientId || "-"}
					</span>
				),
			},
			{ header: "IP", accessorKey: "ip", size: 150 },
			{
				header: "浏览器",
				accessorKey: "browser",
				size: 220,
				cell: ({ row }) => (
					<span className="block max-w-[320px] truncate" title={row.original.browser || ""}>
						{row.original.browser || "-"}
					</span>
				),
			},
			{ header: "登录时间", accessorKey: "loginTime", size: 180 },
			{ header: "最后活跃", accessorKey: "lastActiveTime", size: 180 },
			{
				header: "Token",
				accessorKey: "token",
				size: 260,
				cell: ({ row }) => (
					<span className="block max-w-[420px] truncate" title={row.original.token || ""}>
						{row.original.token || "-"}
					</span>
				),
			},
		];

		if (!can("monitor:online:kickout")) return base;

		base.push({
			header: "操作",
			id: "operation",
			size: 140,
			meta: { align: "center" },
			cell: ({ row }) => {
				const record = row.original;
				const isSelf = Boolean(accessToken && record.token && record.token === accessToken);
				return (
					<OperationActions
						items={[
							{
								key: "kickout",
								label: "强退",
								variant: "destructive",
								disabled: isSelf || kickoutMutation.isPending,
								title: isSelf ? "不能强退自己" : undefined,
								onClick: async () => {
									if (isSelf) {
										toast.error("不能强退自己", { position: "top-center" });
										return;
									}
									const ok = await confirm({
										title: "确认强退？",
										description: `用户：${record.nickname || record.username || "-"}`,
										confirmText: "强退",
										destructive: true,
									});
									if (!ok) return;
									try {
										await kickoutMutation.mutateAsync(record.token);
										toast.success("强退成功", { position: "top-center" });
									} catch {
										// handled by apiClient
									}
								},
							},
						]}
						maxVisible={1}
					/>
				);
			},
		});
		return base;
	}, [accessToken, can, confirm, kickoutMutation.isPending, kickoutMutation.mutateAsync]);

	return (
		<Card>
			<CardContent>
				<DataTable<OnlineUserRow>
					title="在线用户"
					actions={
						<Button size="sm" variant="secondary" onClick={refresh}>
							刷新
						</Button>
					}
					search={
						<>
							<Input
								value={nickname}
								onChange={(e) => setNickname(e.target.value)}
								placeholder="昵称/用户名"
								className="w-[240px]"
							/>
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
									setQueryNickname(nickname.trim());
									setQueryLoginTime(
										loginTimeRange
											? [loginTimeRange[0].format("YYYY-MM-DD HH:mm:ss"), loginTimeRange[1].format("YYYY-MM-DD HH:mm:ss")]
											: undefined,
									);
								}}
							>
								查询
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									setNickname("");
									setLoginTimeRange(null);
									setPage(1);
									setQueryNickname("");
									setQueryLoginTime(undefined);
								}}
							>
								重置
							</Button>
						</>
					}
					columns={columns}
					data={data?.list || []}
					loading={isFetching}
					getRowId={(row) => String(row.token)}
					pagination={{
						page,
						pageSize,
						total: data?.total || 0,
						onChange: (p, s) => {
							setPage(p);
							setPageSize(s);
						},
						pageSizeOptions: [10, 20, 30, 50, 100],
					}}
				/>
			</CardContent>
			{ConfirmDialog}
		</Card>
	);
}
