import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { systemUserService, type UserImportParseResp, type UserImportReq } from "@/api/services/systemUserService";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet";

const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

export type UserImportSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

export default function UserImportSheet({ open, onOpenChange, onSuccess }: UserImportSheetProps) {
	const [file, setFile] = useState<File | null>(null);
	const [parseResult, setParseResult] = useState<UserImportParseResp | null>(null);

	const [duplicateUser, setDuplicateUser] = useState(1);
	const [duplicateEmail, setDuplicateEmail] = useState(1);
	const [duplicatePhone, setDuplicatePhone] = useState(1);
	const [defaultStatus, setDefaultStatus] = useState(1);

	useEffect(() => {
		if (!open) return;
		setFile(null);
		setParseResult(null);
		setDuplicateUser(1);
		setDuplicateEmail(1);
		setDuplicatePhone(1);
		setDefaultStatus(1);
	}, [open]);

	const downloadTemplateMutation = useMutation({
		mutationFn: () => systemUserService.downloadImportTemplate(),
	});
	const parseMutation = useMutation({
		mutationFn: (f: File) => systemUserService.parseImport(f),
	});
	const importMutation = useMutation({
		mutationFn: (payload: UserImportReq) => systemUserService.importUsers(payload),
	});

	const canImport = useMemo(() => Boolean(parseResult?.importKey), [parseResult?.importKey]);

	const onDownloadTemplate = async () => {
		try {
			const blob = await downloadTemplateMutation.mutateAsync();
			downloadBlob(blob, "user_import_template.csv");
		} catch {
			// handled by apiClient
		}
	};

	const onParse = async () => {
		if (!file) {
			toast.error("请先选择文件", { position: "top-center" });
			return;
		}
		try {
			const data = await parseMutation.mutateAsync(file);
			setParseResult(data);
			toast.success("上传解析成功", { position: "top-center" });
		} catch {
			// handled by apiClient
		}
	};

	const onImport = async () => {
		if (!parseResult?.importKey) {
			toast.error("请先上传并解析文件", { position: "top-center" });
			return;
		}
		try {
			const res = await importMutation.mutateAsync({
				importKey: parseResult.importKey,
				errorPolicy: 1,
				duplicateUser,
				duplicateEmail,
				duplicatePhone,
				defaultStatus,
			});
			toast.success(`导入成功：新增${res.insertRows}，修改${res.updateRows}`, { position: "top-center" });
			onSuccess();
			onOpenChange(false);
		} catch {
			// handled by apiClient
		}
	};

	const busy = downloadTemplateMutation.isPending || parseMutation.isPending || importMutation.isPending;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-[560px] sm:max-w-[560px] p-0 flex flex-col">
				<SheetHeader className="p-4 border-b">
					<SheetTitle>导入用户</SheetTitle>
				</SheetHeader>
				<div className="p-4 flex-1 overflow-auto space-y-5">
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm font-medium">1. 下载模板</div>
							<Button variant="secondary" disabled={busy} onClick={onDownloadTemplate}>
								下载模板
							</Button>
						</div>
						<div className="text-xs text-muted-foreground">当前后端模板为 CSV（与 Vue3 的 Excel 模板不同）。</div>
					</div>

					<div className="space-y-2">
						<div className="text-sm font-medium">2. 解析数据</div>
						<div className="grid gap-2">
							<Label>选择文件</Label>
							<Input
								type="file"
								accept=".csv,.xls,.xlsx"
								onChange={(e) => {
									const f = e.target.files?.[0] || null;
									setFile(f);
								}}
							/>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="secondary" disabled={busy || !file} onClick={onParse}>
								上传解析
							</Button>
							{parseResult?.importKey && (
								<span className="text-xs text-muted-foreground">importKey: {parseResult.importKey}</span>
							)}
						</div>
						{parseResult && (
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>总计行数：{parseResult.totalRows}</div>
								<div>正常行数：{parseResult.validRows}</div>
								<div>已存在用户：{parseResult.duplicateUserRows}</div>
								<div>已存在邮箱：{parseResult.duplicateEmailRows}</div>
								<div>已存在手机：{parseResult.duplicatePhoneRows}</div>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<div className="text-sm font-medium">3. 导入策略</div>
						<div className="grid gap-3">
							<div className="grid gap-2">
								<Label>用户已存在</Label>
								<Select value={String(duplicateUser)} onValueChange={(v) => setDuplicateUser(Number(v))}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">跳过该行</SelectItem>
										<SelectItem value="3">停止导入</SelectItem>
										<SelectItem value="2">修改数据</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label>邮箱已存在</Label>
								<Select value={String(duplicateEmail)} onValueChange={(v) => setDuplicateEmail(Number(v))}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">跳过该行</SelectItem>
										<SelectItem value="3">停止导入</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label>手机已存在</Label>
								<Select value={String(duplicatePhone)} onValueChange={(v) => setDuplicatePhone(Number(v))}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">跳过该行</SelectItem>
										<SelectItem value="3">停止导入</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label>默认状态</Label>
								<Select value={String(defaultStatus)} onValueChange={(v) => setDefaultStatus(Number(v))}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">启用</SelectItem>
										<SelectItem value="2">禁用</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				</div>
				<SheetFooter className="p-4 border-t flex gap-2">
					<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={busy || !canImport} onClick={onImport}>
						确认导入
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
