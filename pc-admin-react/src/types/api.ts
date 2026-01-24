import type { ResultStatus } from "./enum";

export interface Result<T = unknown> {
	status: ResultStatus;
	message: string;
	data: T;
}

/**
 * Go 后端统一响应结构（backend-go / backend-python 对齐）。
 * - success=true 时 data 为业务数据
 * - success=false 时 code/msg 表示业务错误（HTTP 仍可能为 200）
 */
export interface ApiRes<T = unknown> {
	success: boolean;
	code: string;
	msg: string;
	data: T;
	timestamp: string;
}
