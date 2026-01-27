import { systemLogService, type SysLogDetail, type SysLogRow } from "@/api/services/systemLogService";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { ScrollArea } from "@/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export default function SysLogPage() {
	const [description, setDescription] = useState("");
	const [module, setModule] = useState("");
	const [ip, setIp] = useState("");
	const [createUser, setCreateUser] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailId, setDetailId] = useState<number | null>(null);
	const [query, setQuery] = useState<{
		description?: string;
		module?: string;
		ip?: string;
		createUserString?: string;
		status?: number;
	}>({});

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
				status: query.status,
			}),
	});

	const columns: ColumnsType<SysLogRow> = useMemo(
		() => [
			{ title: "ID", dataIndex: "id", width: 90 },
			{ title: "Module", dataIndex: "module", width: 140 },
			{ title: "Description", dataIndex: "description", width: 280, ellipsis: true },
			{ title: "User", dataIndex: "createUserString", width: 140 },
			{ title: "IP", dataIndex: "ip", width: 140 },
			{ title: "Status", dataIndex: "status", width: 90 },
			{ title: "Time(ms)", dataIndex: "timeTaken", width: 110 },
			{ title: "Error", dataIndex: "errorMsg", width: 240, ellipsis: true },
			{ title: "Created", dataIndex: "createTime", width: 180 },
		],
		[],
	);

	const { data: detail, isFetching: isDetailFetching } = useQuery({
		queryKey: ["system.log.get", detailId || 0],
		enabled: detailOpen && Boolean(detailId),
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
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>Log</div>
						<div className="flex flex-wrap items-center gap-2">
							<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Keyword" className="w-[200px]" />
							<Input value={module} onChange={(e) => setModule(e.target.value)} placeholder="Module" className="w-[150px]" />
							<Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP" className="w-[150px]" />
							<Input value={createUser} onChange={(e) => setCreateUser(e.target.value)} placeholder="User" className="w-[150px]" />
							<Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status(1/2)" className="w-[110px]" />
							<Button
								onClick={() => {
									const s = Number(status.trim());
									setPage(1);
									setQuery({
										description: description.trim() || undefined,
										module: module.trim() || undefined,
										ip: ip.trim() || undefined,
										createUserString: createUser.trim() || undefined,
										status: Number.isFinite(s) && s > 0 ? s : undefined,
									});
								}}
							>
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Table<SysLogRow>
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
						onRow={(record) => ({
							onClick: () => {
								setDetailId(record.id);
								setDetailOpen(true);
							},
						})}
						rowClassName="cursor-pointer"
					/>
					<div className="mt-2 text-xs text-muted-foreground">点击行查看详情</div>
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
						{!isDetailFetching && !detail && <div className="text-sm text-muted-foreground">No data</div>}
						{detail && <LogDetailView detail={detail} renderMeta={renderMeta} renderBlock={renderBlock} />}
					</div>
				</SheetContent>
			</Sheet>
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
