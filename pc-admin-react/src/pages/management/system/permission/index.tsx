import { systemMenuService, type SysMenuNode } from "@/api/services/systemMenuService";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import Table, { type ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BasicStatus } from "#/enum";

const stripEmptyChildren = (nodes: SysMenuNode[]): SysMenuNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

export default function PermissionPage() {
	const { t } = useTranslation();
	const [keyword, setKeyword] = useState("");

	const { data, isFetching } = useQuery({
		queryKey: ["systemMenu.tree"],
		queryFn: () => systemMenuService.tree(),
	});

	const filteredData = useMemo(() => {
		const term = keyword.trim().toLowerCase();
		if (!term) return stripEmptyChildren(data || []);

		const filterNode = (node: SysMenuNode): SysMenuNode | null => {
			const hit =
				(node.title || "").toLowerCase().includes(term) ||
				(node.path || "").toLowerCase().includes(term) ||
				(node.permission || "").toLowerCase().includes(term);
			const children = (node.children || [])
				.map(filterNode)
				.filter((x): x is SysMenuNode => x != null);
			if (hit || children.length > 0) {
				return { ...node, children: children.length > 0 ? children : undefined };
			}
			return null;
		};

		return stripEmptyChildren((data || []).map(filterNode).filter((x): x is SysMenuNode => x != null));
	}, [data, keyword]);

	const columns: ColumnsType<SysMenuNode> = useMemo(
		() => [
			{ title: t("sys.page.systemPermission.columns.title"), dataIndex: "title", width: 260 },
			{ title: t("sys.page.systemPermission.columns.type"), dataIndex: "type", width: 80 },
			{ title: t("sys.page.systemPermission.columns.path"), dataIndex: "path", width: 220 },
			{ title: t("sys.page.systemPermission.columns.permission"), dataIndex: "permission" },
			{
				title: t("sys.page.systemPermission.columns.status"),
				dataIndex: "status",
				width: 100,
				render: (v: number) =>
					v === BasicStatus.DISABLE
						? t("sys.page.systemPermission.status.disable")
						: t("sys.page.systemPermission.status.enable"),
			},
		],
		[t],
	);
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>{t("sys.nav.system.permission")}</div>
					<Input
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder={t("sys.page.systemPermission.searchPlaceholder")}
						className="w-[280px]"
					/>
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
					expandable={{
						rowExpandable: (record) => (record.children?.length ?? 0) > 0,
					}}
				/>
			</CardContent>
		</Card>
	);
}
