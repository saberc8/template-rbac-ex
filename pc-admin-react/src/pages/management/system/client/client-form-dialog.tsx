// 客户端配置表单弹窗：对接 /system/client（新增/编辑）

import { systemClientService, type SysClientSaveReq } from "@/api/services/systemClientService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";

type ClientFormMode = "create" | "update";

const parseAuthType = (raw: string): string[] => {
	const parts = (raw || "")
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);
	return Array.from(new Set(parts));
};

export default function ClientFormDialog({
	open,
	mode,
	id,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: ClientFormMode;
	id?: number | null;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysClientSaveReq) => Promise<void> | void;
}) {
	const isUpdate = mode === "update";
	const enabled = open && isUpdate && Boolean(id && id > 0);

	const { data: detail, isFetching } = useQuery({
		queryKey: ["systemClient.get", id || 0],
		queryFn: () => systemClientService.get(Number(id || 0)),
		enabled,
	});

	const [clientId, setClientId] = useState("");
	const [clientType, setClientType] = useState("");
	const [authTypeRaw, setAuthTypeRaw] = useState("");
	const [activeTimeout, setActiveTimeout] = useState<number>(1800);
	const [timeout, setTimeout] = useState<number>(86400);
	const [status, setStatus] = useState<number>(BasicStatus.ENABLE);

	useEffect(() => {
		if (!open) return;
		if (!isUpdate) {
			setClientId("");
			setClientType("");
			setAuthTypeRaw("");
			setActiveTimeout(1800);
			setTimeout(86400);
			setStatus(BasicStatus.ENABLE);
			return;
		}
	}, [isUpdate, open]);

	useEffect(() => {
		if (!open || !isUpdate) return;
		if (!detail) return;
		setClientId(detail.clientId || "");
		setClientType(detail.clientType || "");
		setAuthTypeRaw(Array.isArray(detail.authType) ? detail.authType.join(",") : "");
		setActiveTimeout(Number(detail.activeTimeout) || 1800);
		setTimeout(Number(detail.timeout) || 86400);
		setStatus(Number(detail.status) || BasicStatus.ENABLE);
	}, [detail, isUpdate, open]);

	const title = useMemo(() => (isUpdate ? "修改客户端" : "新增客户端"), [isUpdate]);

	const doSubmit = async () => {
		const ct = clientType.trim();
		const auth = parseAuthType(authTypeRaw);
		if (!ct) {
			toast.error("客户端类型不能为空", { position: "top-center" });
			return;
		}
		if (!auth.length) {
			toast.error("认证类型不能为空", { position: "top-center" });
			return;
		}

		await onSubmit({
			clientType: ct,
			authType: auth,
			activeTimeout: Number(activeTimeout) || 0,
			timeout: Number(timeout) || 0,
			status: Number(status) || BasicStatus.ENABLE,
		});
	};

	const loading = Boolean(busy || isFetching);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[760px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{isUpdate && (
						<div className="space-y-2 md:col-span-2">
							<Label>客户端 ID</Label>
							<Input value={clientId} disabled />
						</div>
					)}

					<div className="space-y-2">
						<Label>客户端类型</Label>
						<Input value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="例如：web/admin" disabled={loading} />
					</div>

					<div className="space-y-2">
						<Label>认证类型</Label>
						<Input
							value={authTypeRaw}
							onChange={(e) => setAuthTypeRaw(e.target.value)}
							placeholder="逗号分隔，例如：password,refresh_token"
							disabled={loading}
						/>
					</div>

					<div className="space-y-2">
						<Label>Token 最低活跃频率（秒）</Label>
						<Input
							type="number"
							value={Number.isFinite(activeTimeout) ? activeTimeout : 0}
							onChange={(e) => setActiveTimeout(e.target.value === "" ? 0 : Number(e.target.value))}
							disabled={loading}
						/>
					</div>

					<div className="space-y-2">
						<Label>Token 有效期（秒）</Label>
						<Input
							type="number"
							value={Number.isFinite(timeout) ? timeout : 0}
							onChange={(e) => setTimeout(e.target.value === "" ? 0 : Number(e.target.value))}
							disabled={loading}
						/>
					</div>

					<div className="flex items-center gap-3 md:col-span-2">
						<Switch checked={status === BasicStatus.ENABLE} onCheckedChange={(checked) => setStatus(checked ? BasicStatus.ENABLE : BasicStatus.DISABLE)} />
						<span className="text-sm text-muted-foreground">{status === BasicStatus.ENABLE ? "启用" : "禁用"}</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button disabled={loading} onClick={doSubmit}>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
