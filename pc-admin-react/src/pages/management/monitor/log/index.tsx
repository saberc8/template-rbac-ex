import { systemLogService, type SysLogDetail, type SysLogRow, type SysLogExportQuery } from "@/api/services/systemLogService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import DataTable from "@/components/data-table/data-table";
import OperationActions from "@/components/data-table/operation-actions";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { ScrollArea } from "@/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet";
import { Badge } from "@/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export default function SysLogPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const [description, setDescription] = useState("");
	const [module, setModule] = useState("");
	const [ip, setIp] = useState("");
	const [createUser, setCreateUser] = useState("");
	const [status, setStatus] = useState("");
	const [createTimeRange, setCreateTimeRange] = useState<[Dayjs, Dayjs]>(() => [
		dayjs().subtract(6, "day").startOf("day"),
		dayjs().endOf("day"),
	]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailId, setDetailId] = useState<number | null>(null);
	const [query, setQuery] = useState<{
		description?: string;
		module?: string;
		ip?: string;
		createUserString?: string;
		createTime?: string[];
		status?: number;
	}>(() => ({
		createTime: [dayjs().subtract(6, "day").startOf("day").format("YYYY-MM-DD HH:mm:ss"), dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss")],
	}));

	const { data, isFetching } = useQuery({
		queryKey: ["system.log.page", page, pageSize, query],
		queryFn: () =>
			systemLogService.page({
				page,
				size: pageSize,
				description: query.description,
					module: query.module,
					ip: query.ip,
					createUserString: query.createUserString,
					createTime: query.createTime,
					status: query.status,
				}),
	});

	const exportLoginMutation = useMutation({
		mutationFn: (q: SysLogExportQuery) => systemLogService.exportLoginCsv(q),
	});
	const exportOperationMutation = useMutation({
		mutationFn: (q: SysLogExportQuery) => systemLogService.exportOperationCsv(q),
	});

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		window.URL.revokeObjectURL(url);
	};

	const refresh = () => queryClient.invalidateQueries({ queryKey: ["system.log.page"] });

	const columns: Array<ColumnDef<SysLogRow>> = useMemo(() => {
		const base: Array<ColumnDef<SysLogRow>> = [
			{ header: "ID", accessorKey: "id", size: 90 },
			{ header: "模块", accessorKey: "module", size: 140 },
			{
				header: "描述",
				accessorKey: "description",
				size: 320,
				cell: ({ row }) => (
					<span className="block max-w-[420px] truncate" title={row.original.description || ""}>
						{row.original.description || "-"}
					</span>
				),
			},
			{ header: "用户", accessorKey: "createUserString", size: 140 },
			{ header: "IP", accessorKey: "ip", size: 140 },
			{
				header: "状态",
				id: "status",
				size: 120,
				meta: { align: "center" },
				cell: ({ row }) => {
					const ok = Number(row.original.status) === 1;
					const badge = <Badge variant={ok ? "success" : "error"}>{ok ? "成功" : "失败"}</Badge>;
					if (ok) return badge;
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="cursor-pointer">{badge}</span>
							</TooltipTrigger>
							<TooltipContent>{row.original.errorMsg || "-"}</TooltipContent>
						</Tooltip>
					);
				},
			},
			{ header: "耗时(ms)", accessorKey: "timeTaken", size: 120, meta: { align: "right" } },
			{
				header: "错误",
				accessorKey: "errorMsg",
				size: 260,
				cell: ({ row }) => (
					<span className="block max-w-[360px] truncate" title={row.original.errorMsg || ""}>
						{row.original.errorMsg || "-"}
					</span>
				),
			},
			{ header: "创建时间", accessorKey: "createTime", size: 180 },
		];

		if (!can("monitor:log:get")) return base;

		base.push({
			header: "操作",
			id: "operation",
			size: 140,
			meta: { align: "center" },
			cell: ({ row }) => (
				<OperationActions
					items={[
						{
							key: "detail",
							label: "详情",
							onClick: () => {
								setDetailId(row.original.id);
								setDetailOpen(true);
							},
						},
					]}
					maxVisible={1}
				/>
			),
		});
		return base;
	}, [can]);

	const { data: detail, isFetching: isDetailFetching } = useQuery({
		queryKey: ["system.log.get", detailId || 0],
		enabled: detailOpen && Boolean(detailId) && can("monitor:log:get"),
		queryFn: () => systemLogService.get(detailId || 0),
	});

	const renderBlock = (label: string, value: string) => (
		<div className="space-y-2">
			<div className="text-sm font-medium">{label}</div>
			<div className="rounded-md border bg-muted/30">
				<ScrollArea className="h-[160px]">
					<pre className="whitespace-pre-wrap break-words p-3 text-xs leading-5">{value || "-"}</pre>
				</ScrollArea>
			</div>
		</div>
	);

	const renderMeta = (label: string, value: string | number) => (
		<div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
			<div className="text-muted-foreground">{label}</div>
			<div className="break-words">{value || "-"}</div>
		</div>
	);

	return (
		<>
			<Card>
				<CardContent>
					<DataTable<SysLogRow>
						title="系统日志"
						actions={
							<div className="flex items-center gap-2">
								<Button size="sm" variant="secondary" onClick={refresh}>
									刷新
								</Button>
								{can("monitor:log:export") && (
									<>
										<Button
											size="sm"
											variant="secondary"
											disabled={exportLoginMutation.isPending}
											onClick={async () => {
												const ok = await confirm({
													title: "导出登录日志？",
													description: "将按当前筛选条件导出 CSV。",
													confirmText: "导出",
												});
												if (!ok) return;
												try {
													const q: SysLogExportQuery = {
														description: query.description,
														module: "登录",
														ip: query.ip,
														createUserString: query.createUserString,
														createTime: query.createTime,
														status: query.status,
													};
													const blob = await exportLoginMutation.mutateAsync(q);
													downloadBlob(blob, "login-log.csv");
													toast.success("导出成功", { position: "top-center" });
												} catch {
													// handled by apiClient
												}
											}}
										>
											导出登录
										</Button>
										<Button
											size="sm"
											variant="secondary"
											disabled={exportOperationMutation.isPending}
											onClick={async () => {
												const ok = await confirm({
													title: "导出操作日志？",
													description: "将按当前筛选条件导出 CSV。",
													confirmText: "导出",
												});
												if (!ok) return;
												try {
													const q: SysLogExportQuery = {
														description: query.description,
														module: query.module,
														ip: query.ip,
														createUserString: query.createUserString,
														createTime: query.createTime,
														status: query.status,
													};
													const blob = await exportOperationMutation.mutateAsync(q);
													downloadBlob(blob, "operation-log.csv");
													toast.success("导出成功", { position: "top-center" });
												} catch {
													// handled by apiClient
												}
											}}
										>
											导出操作
										</Button>
									</>
								)}
							</div>
						}
						search={
							<>
								<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="关键字" className="w-[200px]" />
								<Input value={module} onChange={(e) => setModule(e.target.value)} placeholder="模块" className="w-[150px]" />
								<Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP" className="w-[150px]" />
								<Input value={createUser} onChange={(e) => setCreateUser(e.target.value)} placeholder="用户" className="w-[150px]" />
								<Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="状态(1/2)" className="w-[110px]" />
								<DatePicker.RangePicker
									value={createTimeRange}
									onChange={(v) => {
										if (v && v[0] && v[1]) setCreateTimeRange([v[0], v[1]]);
									}}
									showTime
									allowClear={false}
								/>
								<Button
									onClick={() => {
										const s = Number(status.trim());
										setPage(1);
										setQuery({
											description: description.trim() || undefined,
											module: module.trim() || undefined,
											ip: ip.trim() || undefined,
											createUserString: createUser.trim() || undefined,
											createTime: [createTimeRange[0].format("YYYY-MM-DD HH:mm:ss"), createTimeRange[1].format("YYYY-MM-DD HH:mm:ss")],
											status: Number.isFinite(s) && s > 0 ? s : undefined,
										});
									}}
								>
									查询
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										setDescription("");
										setModule("");
										setIp("");
										setCreateUser("");
										setStatus("");
										setCreateTimeRange([dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")]);
										setPage(1);
										setQuery({
											createTime: [dayjs().subtract(6, "day").startOf("day").format("YYYY-MM-DD HH:mm:ss"), dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss")],
										});
									}}
								>
									重置
								</Button>
							</>
						}
						columns={columns}
						data={data?.list || []}
						loading={isFetching}
						getRowId={(row) => String(row.id)}
						onRowClick={
							can("monitor:log:get")
								? (row) => {
										setDetailId(row.id);
										setDetailOpen(true);
									}
								: undefined
						}
						rowClassName={can("monitor:log:get") ? () => "cursor-pointer" : undefined}
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
					<div className="mt-2 text-xs text-muted-foreground">{can("monitor:log:get") ? "点击行查看详情" : "无查看详情权限"}</div>
				</CardContent>
			</Card>

			<Sheet
				open={detailOpen}
				onOpenChange={(open) => {
					setDetailOpen(open);
					if (!open) setDetailId(null);
				}}
			>
				<SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0 flex flex-col">
					<SheetHeader className="p-4 border-b">
						<SheetTitle>Log Detail</SheetTitle>
					</SheetHeader>
					<div className="p-4 flex-1 overflow-hidden">
						{isDetailFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
						{!isDetailFetching && !detail && <div className="text-sm text-muted-foreground">{can("monitor:log:get") ? "No data" : "无查看详情权限"}</div>}
						{detail && <LogDetailView detail={detail} renderMeta={renderMeta} renderBlock={renderBlock} />}
					</div>
				</SheetContent>
			</Sheet>
			{ConfirmDialog}
		</>
	);
}

function LogDetailView({
	detail,
	renderMeta,
	renderBlock,
}: {
	detail: SysLogDetail;
	renderMeta: (label: string, value: string | number) => React.ReactNode;
	renderBlock: (label: string, value: string) => React.ReactNode;
}) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				{renderMeta("ID", detail.id)}
				{renderMeta("TraceId", detail.traceId)}
				{renderMeta("Module", detail.module)}
				{renderMeta("Description", detail.description)}
				{renderMeta("CreateUser", detail.createUserString)}
				{renderMeta("CreateTime", detail.createTime)}
				{renderMeta("Status", detail.status)}
				{renderMeta("StatusCode", detail.statusCode)}
				{renderMeta("TimeTaken(ms)", detail.timeTaken)}
				{renderMeta("IP", detail.ip)}
				{renderMeta("Address", detail.address)}
				{renderMeta("Browser", detail.browser)}
				{renderMeta("OS", detail.os)}
				{renderMeta("Request", `${detail.requestMethod} ${detail.requestUrl}`)}
				{renderMeta("Error", detail.errorMsg)}
			</div>
			{renderBlock("RequestHeaders", detail.requestHeaders)}
			{renderBlock("RequestBody", detail.requestBody)}
			{renderBlock("ResponseHeaders", detail.responseHeaders)}
			{renderBlock("ResponseBody", detail.responseBody)}
		</div>
	);
}
