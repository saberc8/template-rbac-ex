// 后端路由页面：系统监控-系统日志（对齐 pc-admin-vue3：登录/操作 Tabs + 筛选/导出 + 操作日志详情）。

import systemLogService from "@/api/services/systemLogService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { DatePicker, Descriptions, Modal, Select, Table, Tabs, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { BackendRouteItem } from "#/backend";
import type { LogDetailResp, LogPageQuery, LogResp } from "#/system";

const { RangePicker } = DatePicker;

const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const defaultRange = (): [string, string] => [
	dayjs().subtract(6, "day").startOf("day").format("YYYY-MM-DD HH:mm:ss"),
	dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss"),
];

const useTabKey = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const search = new URLSearchParams(location.search);
	const tabKey = search.get("tabKey") || "1";
	const setTabKey = (next: string) => {
		const sp = new URLSearchParams(location.search);
		sp.set("tabKey", next);
		navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
	};
	return { tabKey, setTabKey };
};

export default function BackendMonitorLogPage({ route }: { route?: BackendRouteItem }) {
	const { tabKey, setTabKey } = useTabKey();

	const { checkAny } = useAuthCheck("permission");
	const canGet = checkAny(["monitor:log:get"]);
	const canExport = checkAny(["monitor:log:export"]);

	// 登录日志
	const [loginPage, setLoginPage] = useState(1);
	const [loginSize, setLoginSize] = useState(10);
	const [loginUser, setLoginUser] = useState("");
	const [loginIp, setLoginIp] = useState("");
	const [loginStatus, setLoginStatus] = useState<number | undefined>(undefined);
	const [loginCreateTime, setLoginCreateTime] = useState<[string, string]>(defaultRange());

	// 操作日志
	const [opPage, setOpPage] = useState(1);
	const [opSize, setOpSize] = useState(10);
	const [opUser, setOpUser] = useState("");
	const [opIp, setOpIp] = useState("");
	const [opDescription, setOpDescription] = useState("");
	const [opModule, setOpModule] = useState("");
	const [opStatus, setOpStatus] = useState<number | undefined>(undefined);
	const [opCreateTime, setOpCreateTime] = useState<[string, string]>(defaultRange());

	const [detailId, setDetailId] = useState<number | null>(null);

	const loginQueryParams: LogPageQuery = useMemo(
		() => ({
			page: loginPage,
			size: loginSize,
			module: "登录",
			createUserString: loginUser || undefined,
			ip: loginIp || undefined,
			status: loginStatus,
			createTime: loginCreateTime,
			sort: ["createTime,desc"],
		}),
		[loginPage, loginSize, loginUser, loginIp, loginStatus, loginCreateTime],
	);

	const opQueryParams: LogPageQuery = useMemo(
		() => ({
			page: opPage,
			size: opSize,
			description: opDescription || undefined,
			module: opModule || undefined,
			createUserString: opUser || undefined,
			ip: opIp || undefined,
			status: opStatus,
			createTime: opCreateTime,
			sort: ["createTime,desc"],
		}),
		[opPage, opSize, opDescription, opModule, opUser, opIp, opStatus, opCreateTime],
	);

	const loginListQuery = useQuery({
		queryKey: ["system.log.page.login", loginQueryParams],
		queryFn: () => systemLogService.pageLog(loginQueryParams),
	});

	const opListQuery = useQuery({
		queryKey: ["system.log.page.operation", opQueryParams],
		queryFn: () => systemLogService.pageLog(opQueryParams),
	});

	const detailQuery = useQuery({
		queryKey: ["system.log.detail", detailId],
		queryFn: () => systemLogService.getLogDetail(detailId as number),
		enabled: typeof detailId === "number" && detailId > 0,
	});

	const detailItems = useMemo(() => {
		const d = detailQuery.data as LogDetailResp | undefined;
		if (!d) return [];
		return [
			{ key: "id", label: "ID", children: String(d.id) },
			{ key: "traceId", label: "TraceID", children: d.traceId },
			{ key: "module", label: "模块", children: d.module },
			{ key: "description", label: "描述", children: d.description },
			{ key: "requestMethod", label: "方法", children: d.requestMethod },
			{ key: "requestUrl", label: "URL", children: d.requestUrl },
			{ key: "statusCode", label: "HTTP 状态", children: String(d.statusCode) },
			{ key: "timeTaken", label: "耗时(ms)", children: String(d.timeTaken) },
			{ key: "ip", label: "IP", children: d.ip },
			{ key: "address", label: "地点", children: d.address },
			{ key: "browser", label: "浏览器", children: d.browser },
			{ key: "os", label: "系统", children: d.os },
			{ key: "errorMsg", label: "错误信息", children: d.errorMsg || "-" },
			{ key: "createUserString", label: "用户", children: d.createUserString },
			{ key: "createTime", label: "时间", children: d.createTime },
			{ key: "requestHeaders", label: "请求头", children: d.requestHeaders || "-" },
			{ key: "requestBody", label: "请求体", children: d.requestBody || "-" },
			{ key: "responseHeaders", label: "响应头", children: d.responseHeaders || "-" },
			{ key: "responseBody", label: "响应体", children: d.responseBody || "-" },
		];
	}, [detailQuery.data]);

	const statusOptions = [
		{ label: "成功", value: 1 },
		{ label: "失败", value: 2 },
	] as const;

	const loginColumns: ColumnsType<LogResp> = [
		{ title: "登录时间", dataIndex: "createTime", width: 180 },
		{ title: "用户昵称", dataIndex: "createUserString", width: 160 },
		{ title: "登录行为", dataIndex: "description", width: 240 },
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (_, record) =>
				record.status === 1 ? (
					<span className="text-green-600">成功</span>
				) : (
					<Tooltip title={record.errorMsg || ""}>
						<span className="text-red-600">失败</span>
					</Tooltip>
				),
		},
		{ title: "登录 IP", dataIndex: "ip", width: 160 },
		{ title: "登录地点", dataIndex: "address", width: 200 },
		{ title: "浏览器", dataIndex: "browser", width: 240 },
		{ title: "终端系统", dataIndex: "os", width: 200 },
	];

	const opColumns: ColumnsType<LogResp> = [
		{
			title: "操作时间",
			dataIndex: "createTime",
			width: 180,
			render: (v, record) =>
				canGet ? (
					<a
						onClick={(e) => {
							e.preventDefault();
							setDetailId(record.id);
						}}
					>
						{v}
					</a>
				) : (
					v
				),
		},
		{ title: "操作人", dataIndex: "createUserString", width: 160 },
		{ title: "操作内容", dataIndex: "description", width: 260 },
		{ title: "所属模块", dataIndex: "module", width: 160 },
		{
			title: "状态",
			dataIndex: "status",
			width: 100,
			render: (_, record) =>
				record.status === 1 ? (
					<span className="text-green-600">成功</span>
				) : (
					<Tooltip title={record.errorMsg || ""}>
						<span className="text-red-600">失败</span>
					</Tooltip>
				),
		},
		{ title: "操作 IP", dataIndex: "ip", width: 160 },
		{ title: "操作地点", dataIndex: "address", width: 200 },
		{
			title: "耗时",
			dataIndex: "timeTaken",
			width: 110,
			render: (v: number) =>
				v > 500 ? <span className="text-red-600">{v}ms</span> : v > 200 ? <span className="text-orange-600">{v}ms</span> : `${v}ms`,
		},
		{ title: "浏览器", dataIndex: "browser", width: 220 },
		{ title: "终端系统", dataIndex: "os", width: 200 },
	];

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">系统日志</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs
						activeKey={tabKey}
						onChange={(k) => setTabKey(String(k))}
						items={[
							{
								key: "1",
								label: "登录日志",
								children: (
									<>
										<div className="mb-3 flex flex-wrap items-center gap-2">
											<Input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="搜索登录用户" className="w-56" />
											<Input value={loginIp} onChange={(e) => setLoginIp(e.target.value)} placeholder="搜索登录 IP 或地点" className="w-56" />
											<RangePicker
												value={[dayjs(loginCreateTime[0], "YYYY-MM-DD HH:mm:ss"), dayjs(loginCreateTime[1], "YYYY-MM-DD HH:mm:ss")]}
												showTime
												allowClear={false}
												onChange={(v) => {
													if (!v || v.length !== 2 || !v[0] || !v[1]) return;
													setLoginCreateTime([v[0].format("YYYY-MM-DD HH:mm:ss"), v[1].format("YYYY-MM-DD HH:mm:ss")]);
													setLoginPage(1);
												}}
											/>
											<Select
												value={loginStatus}
												onChange={(v) => {
													setLoginStatus(v);
													setLoginPage(1);
												}}
												allowClear
												placeholder="状态"
												className="w-28"
												options={[...statusOptions]}
											/>
											<Button
												variant="outline"
												onClick={() => {
													setLoginUser("");
													setLoginIp("");
													setLoginStatus(undefined);
													setLoginCreateTime(defaultRange());
													setLoginPage(1);
												}}
											>
												重置
											</Button>
											<Button
												variant="outline"
												disabled={!canExport}
												onClick={async () => {
													const resp = await systemLogService.exportLoginLog(loginQueryParams as Partial<LogPageQuery>);
													downloadBlob(resp.data, "login-log.csv");
												}}
											>
												导出
											</Button>
											<Button variant="outline" onClick={() => loginListQuery.refetch()}>
												刷新
											</Button>
										</div>

										<Table<LogResp>
											rowKey="id"
											size="small"
											loading={loginListQuery.isFetching}
											scroll={{ x: "max-content" }}
											columns={loginColumns}
											dataSource={loginListQuery.data?.list || []}
											pagination={{
												current: loginPage,
												pageSize: loginSize,
												total: loginListQuery.data?.total || 0,
												showSizeChanger: true,
												onChange: (p, s) => {
													setLoginPage(p);
													setLoginSize(s);
												},
											}}
										/>
									</>
								),
							},
							{
								key: "2",
								label: "操作日志",
								children: (
									<>
										<div className="mb-3 flex flex-wrap items-center gap-2">
											<Input value={opUser} onChange={(e) => setOpUser(e.target.value)} placeholder="搜索操作人" className="w-48" />
											<Input value={opIp} onChange={(e) => setOpIp(e.target.value)} placeholder="搜索操作 IP 或地点" className="w-56" />
											<Input value={opDescription} onChange={(e) => setOpDescription(e.target.value)} placeholder="操作内容" className="w-56" />
											<Input value={opModule} onChange={(e) => setOpModule(e.target.value)} placeholder="所属模块" className="w-40" />
											<RangePicker
												value={[dayjs(opCreateTime[0], "YYYY-MM-DD HH:mm:ss"), dayjs(opCreateTime[1], "YYYY-MM-DD HH:mm:ss")]}
												showTime
												allowClear={false}
												onChange={(v) => {
													if (!v || v.length !== 2 || !v[0] || !v[1]) return;
													setOpCreateTime([v[0].format("YYYY-MM-DD HH:mm:ss"), v[1].format("YYYY-MM-DD HH:mm:ss")]);
													setOpPage(1);
												}}
											/>
											<Select
												value={opStatus}
												onChange={(v) => {
													setOpStatus(v);
													setOpPage(1);
												}}
												allowClear
												placeholder="状态"
												className="w-28"
												options={[...statusOptions]}
											/>
											<Button
												variant="outline"
												onClick={() => {
													setOpUser("");
													setOpIp("");
													setOpDescription("");
													setOpModule("");
													setOpStatus(undefined);
													setOpCreateTime(defaultRange());
													setOpPage(1);
												}}
											>
												重置
											</Button>
											<Button
												variant="outline"
												disabled={!canExport}
												onClick={async () => {
													const resp = await systemLogService.exportOperationLog(opQueryParams as Partial<LogPageQuery>);
													downloadBlob(resp.data, "operation-log.csv");
												}}
											>
												导出
											</Button>
											<Button variant="outline" onClick={() => opListQuery.refetch()}>
												刷新
											</Button>
										</div>

										<Table<LogResp>
											rowKey="id"
											size="small"
											loading={opListQuery.isFetching}
											scroll={{ x: "max-content" }}
											columns={opColumns}
											dataSource={opListQuery.data?.list || []}
											pagination={{
												current: opPage,
												pageSize: opSize,
												total: opListQuery.data?.total || 0,
												showSizeChanger: true,
												onChange: (p, s) => {
													setOpPage(p);
													setOpSize(s);
												},
											}}
										/>
									</>
								),
							},
						]}
					/>
				</CardContent>
			</Card>

			<Modal
				open={detailId !== null}
				title="操作日志详情"
				onCancel={() => setDetailId(null)}
				footer={null}
				width={1000}
			>
				<Descriptions bordered size="small" column={2} items={detailItems} />
			</Modal>
		</>
	);
}
