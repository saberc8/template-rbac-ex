import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";

const CARDS = Array.from({ length: 10 }).map((_, index) => ({
	id: `card-${index + 1}`,
	title: `Card ${index + 1}`,
	description: "用于演示页面与权限占位内容（已移除 mock 数据生成）。",
	content:
		"这里是静态示例内容。\n\n如果需要真实业务数据，请将该页面替换为实际后端接口驱动的实现。",
}));

export default function PermissionPageTest() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			{CARDS.map((card) => (
				<Card key={card.id}>
					<CardHeader>
						<CardTitle>{card.title}</CardTitle>
						<CardDescription>{card.description}</CardDescription>
					</CardHeader>
					<CardContent className="whitespace-pre-line">{card.content}</CardContent>
				</Card>
			))}
		</div>
	);
}
