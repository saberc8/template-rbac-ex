import { themeVars } from "@/theme/theme.css";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { ScrollArea, ScrollBar } from "@/ui/scroll-area";

const TEXT =
	"该页面用于演示滚动条组件。\n\n为了避免引入 mock 数据生成依赖，这里使用静态长文本作为示例内容。\n\n你可以在此替换为真实业务内容或后端接口返回的数据。\n\n".repeat(12);
export default function ScrollbarView() {
	return (
		<>
			<Button variant="link" asChild>
				<a
					href="https://grsmto.github.io/simplebar/"
					style={{ color: themeVars.colors.palette.primary.default }}
					className="mb-4 block"
				>
					https://grsmto.github.io/simplebar/
				</a>
			</Button>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card title="Vertical">
					<CardHeader>
						<CardTitle>Vertical</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[420px] whitespace-pre-line">{TEXT}</ScrollArea>
					</CardContent>
				</Card>
				<Card title="Horizontal">
					<CardHeader>
						<CardTitle>Horizontal</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="w-full pb-2">
							<div className="whitespace-pre-line" style={{ width: "200%" }}>
								{TEXT}
							</div>
							<ScrollBar orientation="horizontal" />
						</ScrollArea>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
