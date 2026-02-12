import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TabsProps } from "antd";
import { Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type SysOption, type SysOptionUpdateReq, systemOptionService } from "@/api/services/systemOptionService";
import { useConfirmDialog } from "@/components/confirm/use-confirm-dialog";
import Icon from "@/components/icon/icon";
import SplitLayout from "@/components/layout/split-layout";
import { usePathname, useRouter, useSearchParams } from "@/routes/hooks";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import ClientPage from "../client";
import SystemSideCard from "../components/system-side-card";
import SystemSideList from "../components/system-side-list";
import StoragePage from "../storage";

const fileToBase64 = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () => reject(new Error("file read failed"));
		reader.readAsDataURL(file);
	});

const toPreviewUrl = (raw: string): string | null => {
	const v = (raw || "").trim();
	if (!v) return null;
	if (v.startsWith("data:image/")) return v;
	if (v.startsWith("http://") || v.startsWith("https://")) return v;
	if (v.startsWith("/")) return v;
	return null;
};

type ConfigTabKey = "site" | "security" | "login" | "storage" | "client";

const useIsDesktop = (breakpoint = 1024) => {
	const [isDesktop, setIsDesktop] = useState<boolean>(() => {
		if (typeof window === "undefined") return true;
		return window.innerWidth >= breakpoint;
	});

	useEffect(() => {
		const onResize = () => setIsDesktop(window.innerWidth >= breakpoint);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [breakpoint]);

	return isDesktop;
};

const toOptionMap = (list: SysOption[] | undefined | null) => {
	const map: Record<string, SysOption> = {};
	for (const it of list || []) map[String(it.code || "")] = it;
	return map;
};

const sanitizeNumber = (v: any, fallback = 0) => {
	const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
	if (!Number.isFinite(n) || n < 0) return fallback;
	return n;
};

function SiteConfigPanel({ canUpdate }: { canUpdate: boolean }) {
	const queryClient = useQueryClient();
	const category = "SITE";
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemOption.list", category],
		queryFn: () => systemOptionService.list({ category }),
	});

	const optionMap = useMemo(() => toOptionMap(data), [data]);
	const codes = useMemo(
		() => ["SITE_LOGO", "SITE_FAVICON", "SITE_TITLE", "SITE_DESCRIPTION", "SITE_COPYRIGHT", "SITE_BEIAN"],
		[],
	);

	const [isUpdate, setIsUpdate] = useState(false);
	const [baseline, setBaseline] = useState<Record<string, string>>({});
	const [draft, setDraft] = useState<Record<string, string>>({});

	useEffect(() => {
		const next: Record<string, string> = {};
		for (const code of codes) next[code] = String(optionMap[code]?.value ?? "");
		setBaseline(next);
		setDraft(next);
		setIsUpdate(false);
	}, [codes, optionMap]);

	const updateMutation = useMutation({
		mutationFn: (items: SysOptionUpdateReq[]) => systemOptionService.update(items),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});

	const resetMutation = useMutation({
		mutationFn: () => systemOptionService.resetValue({ category }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});

	const busy = updateMutation.isPending || resetMutation.isPending;

	const resetDraft = () => setDraft(baseline);
	const cancel = () => {
		resetDraft();
		setIsUpdate(false);
	};

	const save = async () => {
		const title = (draft.SITE_TITLE || "").trim();
		const desc = (draft.SITE_DESCRIPTION || "").trim();
		const copyright = (draft.SITE_COPYRIGHT || "").trim();
		if (!title) {
			toast.error("系统名称不能为空", { position: "top-center" });
			return;
		}
		if (!desc) {
			toast.error("系统描述不能为空", { position: "top-center" });
			return;
		}
		if (!copyright) {
			toast.error("版权声明不能为空", { position: "top-center" });
			return;
		}

		const payload: SysOptionUpdateReq[] = [];
		for (const code of codes) {
			const opt = optionMap[code];
			if (!opt) continue;
			payload.push({ id: Number(opt.id), code, value: String(draft[code] ?? "") });
		}

		try {
			await updateMutation.mutateAsync(payload);
			toast.success("保存成功", { position: "top-center" });
			setIsUpdate(false);
		} catch {
			// handled by apiClient
		}
	};

	const resetDefault = async () => {
		const ok = await confirm({
			title: "确认恢复默认？",
			description: "确认恢复网站配置为默认值吗？",
			confirmText: "恢复默认",
			destructive: true,
		});
		if (!ok) return;
		try {
			await resetMutation.mutateAsync();
			toast.success("恢复成功", { position: "top-center" });
		} catch {
			// handled by apiClient
		}
	};

	const renderImageField = (code: string) => {
		const val = String(draft[code] ?? "");
		const preview = toPreviewUrl(val);
		return (
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-3">
					{preview ? (
						<img src={preview} alt="preview" className="h-12 w-12 rounded border object-contain bg-muted" />
					) : null}
					<input
						type="file"
						accept="image/*"
						disabled={!isUpdate || !canUpdate || busy}
						onChange={async (e) => {
							const f = e.target.files?.[0];
							if (!f) return;
							if (f.size > 1024 * 1024) {
								toast.warning("图片较大（>1MB），可能影响保存速度", { position: "top-center" });
							}
							try {
								const b64 = await fileToBase64(f);
								setDraft((p) => ({ ...p, [code]: b64 }));
								toast.success("已读取图片并写入配置值", { position: "top-center" });
							} catch {
								toast.error("读取图片失败", { position: "top-center" });
							} finally {
								e.target.value = "";
							}
						}}
					/>
				</div>
				<Input
					value={val}
					disabled={!isUpdate || !canUpdate || busy}
					onChange={(e) => setDraft((p) => ({ ...p, [code]: e.target.value }))}
					placeholder="图片 URL / 相对路径 / base64(data:image/*)"
				/>
			</div>
		);
	};

	const renderTextField = (code: string, placeholder?: string) => (
		<Input
			value={String(draft[code] ?? "")}
			disabled={!isUpdate || !canUpdate || busy}
			onChange={(e) => setDraft((p) => ({ ...p, [code]: e.target.value }))}
			placeholder={placeholder || "请输入"}
		/>
	);

	const renderTextareaField = (code: string, placeholder?: string) => (
		<Textarea
			value={String(draft[code] ?? "")}
			disabled={!isUpdate || !canUpdate || busy}
			onChange={(e) => setDraft((p) => ({ ...p, [code]: e.target.value }))}
			placeholder={placeholder || "请输入"}
		/>
	);

	const field = (code: string) => (
		<div className="space-y-2">
			<Label>{optionMap[code]?.name || code}</Label>
			{optionMap[code]?.description ? (
				<div className="text-xs text-muted-foreground">{optionMap[code]?.description}</div>
			) : null}
			{code === "SITE_LOGO" || code === "SITE_FAVICON"
				? renderImageField(code)
				: code === "SITE_DESCRIPTION"
					? renderTextareaField(code, "请输入系统描述")
					: renderTextField(code)}
		</div>
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>网站配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button disabled={!canUpdate || busy || isFetching} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button variant="secondary" disabled={!canUpdate || busy || isFetching} onClick={resetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button disabled={!canUpdate || busy} onClick={save}>
									保存
								</Button>
								<Button variant="secondary" disabled={busy} onClick={resetDraft}>
									重置
								</Button>
								<Button variant="secondary" disabled={busy} onClick={cancel}>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
				{!isFetching && (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="md:col-span-2">{field("SITE_LOGO")}</div>
						<div className="md:col-span-2">{field("SITE_FAVICON")}</div>
						{field("SITE_TITLE")}
						{field("SITE_BEIAN")}
						<div className="md:col-span-2">{field("SITE_DESCRIPTION")}</div>
						<div className="md:col-span-2">{field("SITE_COPYRIGHT")}</div>
					</div>
				)}
			</CardContent>
			{ConfirmDialog}
		</Card>
	);
}

function SecurityConfigPanel({ canUpdate }: { canUpdate: boolean }) {
	const queryClient = useQueryClient();
	const category = "PASSWORD";
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemOption.list", category],
		queryFn: () => systemOptionService.list({ category }),
	});

	const optionMap = useMemo(() => toOptionMap(data), [data]);
	const numberCodes = useMemo(
		() => [
			"PASSWORD_ERROR_LOCK_COUNT",
			"PASSWORD_ERROR_LOCK_MINUTES",
			"PASSWORD_EXPIRATION_DAYS",
			"PASSWORD_EXPIRATION_WARNING_DAYS",
			"PASSWORD_REPETITION_TIMES",
			"PASSWORD_MIN_LENGTH",
		],
		[],
	);
	const switchCodes = useMemo(() => ["PASSWORD_ALLOW_CONTAIN_USERNAME", "PASSWORD_REQUIRE_SYMBOLS"], []);
	const codes = useMemo(() => [...numberCodes, ...switchCodes], [numberCodes, switchCodes]);

	const [isUpdate, setIsUpdate] = useState(false);
	const [baseline, setBaseline] = useState<Record<string, number>>({});
	const [draft, setDraft] = useState<Record<string, number>>({});

	useEffect(() => {
		const next: Record<string, number> = {};
		for (const code of numberCodes) next[code] = sanitizeNumber(optionMap[code]?.value ?? 0, 0);
		for (const code of switchCodes) next[code] = sanitizeNumber(optionMap[code]?.value ?? 0, 0) ? 1 : 0;
		setBaseline(next);
		setDraft(next);
		setIsUpdate(false);
	}, [numberCodes, optionMap, switchCodes]);

	const updateMutation = useMutation({
		mutationFn: (items: SysOptionUpdateReq[]) => systemOptionService.update(items),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});
	const resetMutation = useMutation({
		mutationFn: () => systemOptionService.resetValue({ category }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});

	const busy = updateMutation.isPending || resetMutation.isPending;

	const resetDraft = () => setDraft(baseline);
	const cancel = () => {
		resetDraft();
		setIsUpdate(false);
	};

	const validate = () => {
		for (const code of numberCodes) {
			const n = draft[code];
			if (!Number.isFinite(n) || n < 0) {
				toast.error("请输入有效的数字", { position: "top-center" });
				return false;
			}
		}
		const exp = draft.PASSWORD_EXPIRATION_DAYS || 0;
		const warn = draft.PASSWORD_EXPIRATION_WARNING_DAYS || 0;
		if (exp > 0 && warn >= exp) {
			toast.error("到期提醒天数必须小于密码过期天数", { position: "top-center" });
			return false;
		}
		return true;
	};

	const save = async () => {
		if (!validate()) return;

		const payload: SysOptionUpdateReq[] = [];
		for (const code of codes) {
			const opt = optionMap[code];
			if (!opt) continue;
			payload.push({ id: Number(opt.id), code, value: draft[code] ?? 0 });
		}

		try {
			await updateMutation.mutateAsync(payload);
			toast.success("保存成功", { position: "top-center" });
			setIsUpdate(false);
		} catch {
			// handled by apiClient
		}
	};

	const resetDefault = async () => {
		const ok = await confirm({
			title: "确认恢复默认？",
			description: "确认恢复安全配置为默认值吗？",
			confirmText: "恢复默认",
			destructive: true,
		});
		if (!ok) return;
		try {
			await resetMutation.mutateAsync();
			toast.success("恢复成功", { position: "top-center" });
		} catch {
			// handled by apiClient
		}
	};

	const numberField = (code: string) => (
		<div className="space-y-2">
			<Label>{optionMap[code]?.name || code}</Label>
			{optionMap[code]?.description ? (
				<div className="text-xs text-muted-foreground">{optionMap[code]?.description}</div>
			) : null}
			<Input
				type="number"
				value={String(draft[code] ?? 0)}
				disabled={!isUpdate || !canUpdate || busy}
				onChange={(e) => setDraft((p) => ({ ...p, [code]: sanitizeNumber(e.target.value, 0) }))}
			/>
		</div>
	);

	const switchField = (code: string) => (
		<div className="space-y-2">
			<Label>{optionMap[code]?.name || code}</Label>
			{optionMap[code]?.description ? (
				<div className="text-xs text-muted-foreground">{optionMap[code]?.description}</div>
			) : null}
			<div className="flex items-center gap-2">
				<Switch
					checked={Number(draft[code] ?? 0) === 1}
					disabled={!isUpdate || !canUpdate || busy}
					onCheckedChange={(v) => setDraft((p) => ({ ...p, [code]: v ? 1 : 0 }))}
				/>
				<span className="text-sm text-muted-foreground">{Number(draft[code] ?? 0) === 1 ? "是" : "否"}</span>
			</div>
		</div>
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>安全配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button disabled={!canUpdate || busy || isFetching} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button variant="secondary" disabled={!canUpdate || busy || isFetching} onClick={resetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button disabled={!canUpdate || busy} onClick={save}>
									保存
								</Button>
								<Button variant="secondary" disabled={busy} onClick={resetDraft}>
									重置
								</Button>
								<Button variant="secondary" disabled={busy} onClick={cancel}>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
				{!isFetching && (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{numberField("PASSWORD_ERROR_LOCK_COUNT")}
						{numberField("PASSWORD_ERROR_LOCK_MINUTES")}
						{numberField("PASSWORD_EXPIRATION_DAYS")}
						{numberField("PASSWORD_EXPIRATION_WARNING_DAYS")}
						{numberField("PASSWORD_REPETITION_TIMES")}
						{numberField("PASSWORD_MIN_LENGTH")}
						{switchField("PASSWORD_ALLOW_CONTAIN_USERNAME")}
						{switchField("PASSWORD_REQUIRE_SYMBOLS")}
					</div>
				)}
			</CardContent>
			{ConfirmDialog}
		</Card>
	);
}

function LoginConfigPanel({ canUpdate }: { canUpdate: boolean }) {
	const queryClient = useQueryClient();
	const category = "LOGIN";
	const code = "LOGIN_CAPTCHA_ENABLED";
	const { confirm, ConfirmDialog } = useConfirmDialog();

	const { data, isFetching } = useQuery({
		queryKey: ["systemOption.list", category],
		queryFn: () => systemOptionService.list({ category }),
	});

	const optionMap = useMemo(() => toOptionMap(data), [data]);

	const [isUpdate, setIsUpdate] = useState(false);
	const [baseline, setBaseline] = useState<number>(0);
	const [draft, setDraft] = useState<number>(0);

	useEffect(() => {
		const v = sanitizeNumber(optionMap[code]?.value ?? 0, 0) ? 1 : 0;
		setBaseline(v);
		setDraft(v);
		setIsUpdate(false);
	}, [optionMap]);

	const updateMutation = useMutation({
		mutationFn: (items: SysOptionUpdateReq[]) => systemOptionService.update(items),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});
	const resetMutation = useMutation({
		mutationFn: () => systemOptionService.resetValue({ category }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list", category] });
		},
	});
	const busy = updateMutation.isPending || resetMutation.isPending;

	const resetDraft = () => setDraft(baseline);
	const cancel = () => {
		resetDraft();
		setIsUpdate(false);
	};

	const save = async () => {
		const opt = optionMap[code];
		if (!opt) {
			toast.error("配置项不存在", { position: "top-center" });
			return;
		}
		try {
			await updateMutation.mutateAsync([{ id: Number(opt.id), code, value: Number(draft) === 1 ? 1 : 0 }]);
			toast.success("保存成功", { position: "top-center" });
			setIsUpdate(false);
		} catch {
			// handled by apiClient
		}
	};

	const resetDefault = async () => {
		const ok = await confirm({
			title: "确认恢复默认？",
			description: "确认恢复登录配置为默认值吗？",
			confirmText: "恢复默认",
			destructive: true,
		});
		if (!ok) return;
		try {
			await resetMutation.mutateAsync();
			toast.success("恢复成功", { position: "top-center" });
		} catch {
			// handled by apiClient
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>登录配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button disabled={!canUpdate || busy || isFetching} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button variant="secondary" disabled={!canUpdate || busy || isFetching} onClick={resetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button disabled={!canUpdate || busy} onClick={save}>
									保存
								</Button>
								<Button variant="secondary" disabled={busy} onClick={resetDraft}>
									重置
								</Button>
								<Button variant="secondary" disabled={busy} onClick={cancel}>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isFetching && <div className="text-sm text-muted-foreground">Loading...</div>}
				{!isFetching && (
					<div className="space-y-2">
						<Label>{optionMap[code]?.name || code}</Label>
						{optionMap[code]?.description ? (
							<div className="text-xs text-muted-foreground">{optionMap[code]?.description}</div>
						) : null}
						<div className="flex items-center gap-2">
							<Switch
								checked={Number(draft) === 1}
								disabled={!isUpdate || !canUpdate || busy}
								onCheckedChange={(v) => setDraft(v ? 1 : 0)}
							/>
							<span className="text-sm text-muted-foreground">{Number(draft) === 1 ? "是" : "否"}</span>
						</div>
					</div>
				)}
			</CardContent>
			{ConfirmDialog}
		</Card>
	);
}

export default function OptionPage() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();

	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const isDesktop = useIsDesktop();

	const tabs = useMemo(() => {
		const base: Array<{
			key: ConfigTabKey;
			label: string;
			icon: string;
			canView: boolean;
		}> = [
			{ key: "site", label: "网站配置", icon: "mdi:apps", canView: can("system:siteConfig:get") },
			{ key: "security", label: "安全配置", icon: "mdi:shield-lock", canView: can("system:securityConfig:get") },
			{ key: "login", label: "登录配置", icon: "mdi:lock", canView: can("system:loginConfig:get") },
			{ key: "storage", label: "存储配置", icon: "mdi:database", canView: can("system:storage:list") },
			{ key: "client", label: "客户端配置", icon: "mdi:cellphone", canView: can("system:client:list") },
		];
		return base.filter((t) => t.canView);
	}, [can]);

	const setUrlTab = useCallback(
		(key: ConfigTabKey) => {
			const params = new URLSearchParams(searchParams);
			params.set("tab", key);
			const qs = params.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname);
		},
		[pathname, router, searchParams],
	);

	const [activeKey, setActiveKey] = useState<ConfigTabKey>(() => {
		const q = String(searchParams.get("tab") || "") as ConfigTabKey;
		return q || "site";
	});

	useEffect(() => {
		if (!tabs.length) return;
		const q = String(searchParams.get("tab") || "") as ConfigTabKey;
		const visibleKeys = new Set(tabs.map((t) => t.key));

		const next = (q && visibleKeys.has(q) ? q : tabs[0]?.key) || "site";
		if (activeKey !== next) setActiveKey(next);
		if (q !== next) setUrlTab(next);
	}, [activeKey, searchParams, setUrlTab, tabs]);

	const canUpdateSite = can("system:siteConfig:update");
	const canUpdateSecurity = can("system:securityConfig:update");
	const canUpdateLogin = can("system:loginConfig:update");

	const items: TabsProps["items"] = useMemo(
		() =>
			tabs.map((t) => ({
				key: t.key,
				label: (
					<div className="flex items-center gap-2">
						<Icon icon={t.icon} size={18} />
						<span>{t.label}</span>
					</div>
				),
				children:
					t.key === "site" ? (
						<SiteConfigPanel canUpdate={canUpdateSite} />
					) : t.key === "security" ? (
						<SecurityConfigPanel canUpdate={canUpdateSecurity} />
					) : t.key === "login" ? (
						<LoginConfigPanel canUpdate={canUpdateLogin} />
					) : t.key === "storage" ? (
						<StoragePage />
					) : (
						<ClientPage />
					),
			})),
		[tabs, canUpdateLogin, canUpdateSecurity, canUpdateSite],
	);

	const content = useMemo(() => {
		if (!tabs.length) return null;
		if (activeKey === "site") return <SiteConfigPanel canUpdate={canUpdateSite} />;
		if (activeKey === "security") return <SecurityConfigPanel canUpdate={canUpdateSecurity} />;
		if (activeKey === "login") return <LoginConfigPanel canUpdate={canUpdateLogin} />;
		if (activeKey === "storage") return <StoragePage />;
		return <ClientPage />;
	}, [activeKey, canUpdateLogin, canUpdateSecurity, canUpdateSite, tabs.length]);

	return (
		<div className="min-h-0">
			{!tabs.length ? (
				<div className="text-sm text-muted-foreground">暂无可用配置项，请检查权限。</div>
			) : isDesktop ? (
				<SplitLayout
					leftWidth={240}
					left={
						<SystemSideCard title="系统配置" contentClassName="pt-0">
							<SystemSideList
								items={tabs.map((t) => ({
									key: t.key,
									title: (
										<div className="flex items-center gap-2 min-w-0">
											<Icon icon={t.icon} size={18} />
											<span className="truncate">{t.label}</span>
										</div>
									),
								}))}
								selectedKey={activeKey}
								onSelect={(k) => {
									const key = k as ConfigTabKey;
									setActiveKey(key);
									setUrlTab(key);
								}}
							/>
						</SystemSideCard>
					}
					right={<div className="min-w-0">{content}</div>}
				/>
			) : (
				<Tabs
					items={items}
					activeKey={activeKey}
					onChange={(k) => {
						const key = k as ConfigTabKey;
						setActiveKey(key);
						setUrlTab(key);
					}}
					tabPosition={isDesktop ? "left" : "top"}
					destroyInactiveTabPane
				/>
			)}
		</div>
	);
}
