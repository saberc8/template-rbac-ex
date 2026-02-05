// ApexCharts 运行时补丁：
// apexcharts@4.x 在 updateOptions 的“options 未变化”分支中错误调用了未定义的 `resolve(this)`（应为 Promise.resolve）。
// 在 Vite dev 下该分支容易触发并导致运行时崩溃（ReferenceError: resolve is not defined）。
// 这里提供一个最小的全局兜底，避免崩溃；后续可通过升级 apexcharts 或上游修复移除。

export {};

if (typeof globalThis !== "undefined") {
	const g = globalThis as any;
	if (typeof g.resolve !== "function") {
		g.resolve = Promise.resolve.bind(Promise);
	}
}

