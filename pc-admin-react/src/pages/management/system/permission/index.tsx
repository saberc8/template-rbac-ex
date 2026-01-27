import { systemMenuService, type SysMenuNode } from "@/api/services/systemMenuService";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import Table, { type ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { BasicStatus } from "#/enum";

export default function PermissionPage() {
	const [keyword, setKeyword] = useState("");

	const { data, isFetching } = useQuery({
		queryKey: ["systemMenu.tree"],
		queryFn: () => systemMenuService.tree(),
	});

	const filteredData = useMemo(() => {
		const term = keyword.trim().toLowerCase();
		if (!term) return data || [];

		const filterNode = (node: SysMenuNode): SysMenuNode | null => {
			const hit =
				(node.title || "").toLowerCase().includes(term) ||
				(node.path || "").toLowerCase().includes(term) ||
				(node.permission || "").toLowerCase().includes(term);
			const children = (node.children || [])
				.map(filterNode)
				.filter((x): x is SysMenuNode => x != null);
			if (hit || children.length > 0) return { ...node, children };
			return null;
		};

		return (data || []).map(filterNode).filter((x): x is SysMenuNode => x != null);
	}, [data, keyword]);

	const columns: ColumnsType<SysMenuNode> = useMemo(
		() => [
			{ title: "Title", dataIndex: "title", width: 260 },
			{ title: "Type", dataIndex: "type", width: 80 },
			{ title: "Path", dataIndex: "path", width: 220 },
			{ title: "Permission", dataIndex: "permission" },
			{
				title: "Status",
				dataIndex: "status",
				width: 100,
				render: (v: number) => (v === BasicStatus.DISABLE ? "Disable" : "Enable"),
			},
		],
		[],
	);
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Menu</div>
					<Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search title/path/permission" className="w-[280px]" />
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysMenuNode>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					pagination={false}
					loading={isFetching}
					columns={columns}
					dataSource={filteredData}
				/>
			</CardContent>
		</Card>
	);
}
