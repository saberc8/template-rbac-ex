import { Icon } from "@/components/icon";
import { systemUserService, type SysUserRow } from "@/api/services/systemUserService";
import { usePathname, useRouter } from "@/routes/hooks";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BasicStatus } from "#/enum";
import { useMemo, useState } from "react";

export default function UserPage() {
	const { push } = useRouter();
	const pathname = usePathname();

	const [keyword, setKeyword] = useState("");
	const [queryKeyword, setQueryKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	const { data, isFetching } = useQuery({
		queryKey: ["systemUser.page", page, pageSize, queryKeyword],
		queryFn: () => systemUserService.page({ page, size: pageSize, description: queryKeyword || undefined }),
	});

	const columns: ColumnsType<SysUserRow> = useMemo(
		() => [
			{
				title: "User",
				dataIndex: "username",
				width: 320,
				render: (_, record) => (
					<div className="flex">
						<img alt="" src={record.avatar} className="h-10 w-10 rounded-full" />
						<div className="ml-2 flex flex-col">
							<span className="text-sm">{record.username}</span>
							<span className="text-xs text-text-secondary">{record.email}</span>
						</div>
					</div>
				),
			},
			{
				title: "Role",
				dataIndex: "roleNames",
				align: "center",
				width: 200,
				render: (roleNames: string[]) => <Badge variant="info">{(roleNames || []).join(", ") || "-"}</Badge>,
			},
			{
				title: "Status",
				dataIndex: "status",
				align: "center",
				width: 120,
				render: (status: number) => (
					<Badge variant={status === BasicStatus.DISABLE ? "error" : "success"}>{status === BasicStatus.DISABLE ? "Disable" : "Enable"}</Badge>
				),
			},
			{
				title: "Action",
				key: "operation",
				align: "center",
				width: 100,
				render: (_, record) => (
					<div className="flex w-full justify-center text-gray-500">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								push(`${pathname}/${record.id}`);
							}}
						>
							<Icon icon="mdi:card-account-details" size={18} />
						</Button>
					</div>
				),
			},
		],
		[pathname, push],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>User List</div>
					<div className="flex items-center gap-2">
						<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search" className="w-[240px]" />
						<Button
							onClick={() => {
								setPage(1);
								setQueryKeyword(keyword.trim());
							}}
						>
							Search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysUserRow>
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
