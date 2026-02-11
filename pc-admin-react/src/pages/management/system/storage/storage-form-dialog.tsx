// 存储配置表单弹窗：对接 /system/storage（新增/编辑）

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import type { SysStorageRow, SysStorageSaveReq } from "@/api/services/systemStorageService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Switch } from "@/ui/switch";

type StorageFormMode = "create" | "update";

export default function StorageFormDialog({
	open,
	mode,
	initial,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: StorageFormMode;
	initial: SysStorageRow | null;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysStorageSaveReq) => Promise<void> | void;
}) {
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [type, setType] = useState<number>(1);
	const [accessKey, setAccessKey] = useState("");
	const [secretKey, setSecretKey] = useState("");
	const [endpoint, setEndpoint] = useState("");
	const [region, setRegion] = useState("");
	const [bucketName, setBucketName] = useState("");
	const [domain, setDomain] = useState("");
	const [description, setDescription] = useState("");
	const [sort, setSort] = useState<number>(999);
	const [status, setStatus] = useState<number>(BasicStatus.ENABLE);
	const [isDefault, setIsDefault] = useState<boolean>(false);

	useEffect(() => {
		if (!open) return;
		if (mode === "update" && initial) {
			setName(initial.name || "");
			setCode(initial.code || "");
			setType(Number(initial.type) || 1);
			setAccessKey(initial.accessKey || "");
			setSecretKey("");
			setEndpoint(initial.endpoint || "");
			setRegion(initial.region || "");
			setBucketName(initial.bucketName || "");
			setDomain(initial.domain || "");
			setDescription(initial.description || "");
			setSort(Number(initial.sort) || 999);
			setStatus(Number(initial.status) || BasicStatus.ENABLE);
			setIsDefault(Boolean(initial.isDefault));
			return;
		}
		setName("");
		setCode("");
		setType(1);
		setAccessKey("");
		setSecretKey("");
		setEndpoint("");
		setRegion("");
		setBucketName("");
		setDomain("");
		setDescription("");
		setSort(999);
		setStatus(BasicStatus.ENABLE);
		setIsDefault(false);
	}, [initial, mode, open]);

	const doSubmit = async () => {
		const nameVal = name.trim();
		const codeVal = code.trim();
		if (!nameVal || !codeVal) {
			toast.error("名称和编码不能为空", { position: "top-center" });
			return;
		}

		const payload: SysStorageSaveReq = {
			name: nameVal,
			code: codeVal,
			type: Number(type) || 1,
			accessKey: accessKey.trim(),
			endpoint: endpoint.trim(),
			region: region.trim(),
			bucketName: bucketName.trim(),
			domain: domain.trim(),
			description: description.trim(),
			sort: Number(sort) || 999,
			status: Number(status) || BasicStatus.ENABLE,
			isDefault: Boolean(isDefault),
		};

		// secretKey 策略：新增必填（后端会校验），编辑时留空则不提交该字段避免覆盖旧值
		const sk = secretKey.trim();
		if (mode === "create") {
			payload.secretKey = sk;
		} else if (sk) {
			payload.secretKey = sk;
		}

		await onSubmit(payload);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[820px]">
				<DialogHeader>
					<DialogTitle>{mode === "create" ? "新增存储配置" : "编辑存储配置"}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>名称</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入名称" />
					</div>

					<div className="space-y-2">
						<Label>编码</Label>
						<Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入编码" />
					</div>

					<div className="space-y-2">
						<Label>类型</Label>
						<Select value={String(type)} onValueChange={(v) => setType(Number(v))}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">本地</SelectItem>
								<SelectItem value="2">OSS/MinIO</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>排序</Label>
						<Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
					</div>

					<div className="space-y-2">
						<Label>AccessKey</Label>
						<Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="可选" />
					</div>

					<div className="space-y-2">
						<Label>SecretKey</Label>
						<Input
							value={secretKey}
							onChange={(e) => setSecretKey(e.target.value)}
							placeholder={mode === "update" ? "不修改请留空" : "请输入密钥（部分类型必填）"}
						/>
					</div>

					<div className="space-y-2">
						<Label>Endpoint</Label>
						<Input
							value={endpoint}
							onChange={(e) => setEndpoint(e.target.value)}
							placeholder="例如：http://127.0.0.1:9000"
						/>
					</div>

					<div className="space-y-2">
						<Label>Region</Label>
						<Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="可选" />
					</div>

					<div className="space-y-2">
						<Label>Bucket</Label>
						<Input value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="可选" />
					</div>

					<div className="space-y-2">
						<Label>Domain</Label>
						<Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="可选" />
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>描述</Label>
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
					</div>

					<div className="flex flex-wrap items-center gap-4 md:col-span-2">
						<div className="flex items-center gap-2">
							<Switch
								checked={status === BasicStatus.ENABLE}
								onCheckedChange={(checked) => setStatus(checked ? BasicStatus.ENABLE : BasicStatus.DISABLE)}
							/>
							<span className="text-sm text-muted-foreground">{status === BasicStatus.ENABLE ? "启用" : "禁用"}</span>
						</div>
						<div className="flex items-center gap-2">
							<Switch checked={isDefault} onCheckedChange={setIsDefault} />
							<span className="text-sm text-muted-foreground">设为默认（也可在列表中单独设置）</span>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={busy} onClick={doSubmit}>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
