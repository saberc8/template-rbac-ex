import { ScrollProgress, useScrollProgress } from "@/components/animate/scroll-progress";
import { themeVars } from "@/theme/theme.css";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

const TEXT =
	"该页面用于演示滚动进度条组件。\n\n为移除 mock 数据生成依赖，这里使用静态长文本作为示例内容。\n\n".repeat(16);
export default function ScrollProgressView() {
	const containerProgress = useScrollProgress("container");

	return (
		<>
			<Button variant="link" asChild>
				<a
					href="https://www.framer.com/motion/"
					style={{ color: themeVars.colors.palette.primary.default }}
					className="mb-4 block"
				>
					https://www.framer.com/motion/
				</a>
			</Button>
			<Card title="ScrollProgress">
				<CardHeader>
					<CardTitle>ScrollProgress</CardTitle>
				</CardHeader>
				<CardContent>
					<ScrollProgress scrollYProgress={containerProgress.scrollYProgress} />
					<div ref={containerProgress.elementRef} className="h-80 overflow-auto">
						{[...Array(4)].map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
							<div key={index} className="whitespace-pre-line">
								{TEXT}
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</>
	);
}
