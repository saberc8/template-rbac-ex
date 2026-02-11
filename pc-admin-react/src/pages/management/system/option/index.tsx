import { systemOptionService, type SysOption, type SysOptionUpdateReq } from "@/api/services/systemOptionService";
import { useUserPermissions } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export default function OptionPage() {
	const queryClient = useQueryClient();
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const permissionCodeSet = useMemo(() => new Set(permissionCodes), [permissionCodes]);
	const can = useCallback((code: string) => permissionCodeSet.has(code), [permissionCodeSet]);

	const [category, setCategory] = useState("");
	const [code, setCode] = useState("");
	const [query, setQuery] = useState<{ category?: string; code?: string[] }>({});
	const [editMode, setEditMode] = useState(false);
	const [draft, setDraft] = useState<Record<number, string>>({});
	const [baseline, setBaseline] = useState<Record<number, string>>({});

	const { data, isFetching } = useQuery({
		queryKey: ["systemOption.list", query],
		queryFn: () => systemOptionService.list(query),
	});

	useEffect(() => {
		if (!data) return;
		const next: Record<number, string> = {};
		for (const it of data) next[Number(it.id)] = String(it.value ?? "");
		setDraft(next);
		setBaseline(next);
		setEditMode(false);
	}, [data]);

	const updatePermCandidates = useMemo(() => {
		const cat = (query.category || "").trim().toUpperCase();
		if (cat === "SITE") return ["system:siteConfig:update"];
		if (cat === "PASSWORD") return ["system:securityConfig:update"];
		if (cat === "LOGIN") return ["system:loginConfig:update"];
		return ["system:siteConfig:update", "system:securityConfig:update", "system:loginConfig:update"];
	}, [query.category]);

	const canUpdate = useMemo(() => updatePermCandidates.some((p) => can(p)), [can, updatePermCandidates]);

	const updateMutation = useMutation({
		mutationFn: (items: SysOptionUpdateReq[]) => systemOptionService.update(items),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list"] });
		},
	});

	const resetMutation = useMutation({
		mutationFn: (params: { category?: string; code?: string[] }) => systemOptionService.resetValue(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemOption.list"] });
		},
	});

	const onSave = async () => {
		const list = data || [];
		const updates: SysOptionUpdateReq[] = [];
		for (const it of list) {
			const id = Number(it.id);
			const nextVal = String(draft[id] ?? "");
			const oldVal = String(baseline[id] ?? "");
			if (nextVal !== oldVal) {
				updates.push({ id, code: it.code, value: nextVal });
			}
		}
		if (!updates.length) {
			toast.info("没有需要保存的改动", { position: "top-center" });
			setEditMode(false);
			return;
		}
		try {
			await updateMutation.mutateAsync(updates);
			toast.success("保存成功", { position: "top-center" });
			setEditMode(false);
		} catch {
			// handled by apiClient
		}
	};

	const onResetDraft = () => {
		setDraft(baseline);
	};

	const onCancel = () => {
		onResetDraft();
		setEditMode(false);
	};

	const onResetValue = () => {
		if (!query.category && !(query.code && query.code.length)) {
			toast.error("请先选择 Category 或输入 Code", { position: "top-center" });
			return;
		}
		Modal.confirm({
			title: "确认恢复默认？",
			content: query.category ? `Category: ${query.category}` : `Codes: ${(query.code || []).join(", ")}`,
			okText: "恢复默认",
			cancelText: "取消",
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await resetMutation.mutateAsync({ category: query.category, code: query.code });
					toast.success("恢复成功", { position: "top-center" });
				} catch {
					// handled by apiClient
				}
			},
		});
	};

	const columns: ColumnsType<SysOption> = useMemo(
		() => [
			{ title: "Name", dataIndex: "name", width: 240 },
			{ title: "Code", dataIndex: "code", width: 240 },
			{
				title: "Value",
				dataIndex: "value",
				width: 360,
				render: (_: any, record: SysOption) => {
					const id = Number(record.id);
					const val = String(draft[id] ?? "");
					const code = String(record.code || "");
					const isLoginCaptcha = code === "LOGIN_CAPTCHA_ENABLED";
					const isImageCode = code === "SITE_LOGO" || code === "SITE_FAVICON";
					const preview = isImageCode ? toPreviewUrl(val) : null;

					if (!editMode) {
						if (isLoginCaptcha) return val === "1" ? "是" : "否";
						return val;
					}

					if (isLoginCaptcha) {
						return (
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={val === "1"}
									disabled={!canUpdate || updateMutation.isPending}
									onChange={(e) => setDraft((p) => ({ ...p, [id]: e.target.checked ? "1" : "0" }))}
								/>
								<span className="text-xs text-muted-foreground">{val === "1" ? "启用" : "关闭"}</span>
							</div>
						);
					}

					return (
						<div className="flex flex-col gap-2">
							<Input
								value={val}
								disabled={!canUpdate || updateMutation.isPending}
								onChange={(e) => setDraft((p) => ({ ...p, [id]: e.target.value }))}
								placeholder="请输入值"
							/>
							{isImageCode && (
								<div className="flex flex-wrap items-center gap-3">
									<input
										type="file"
										accept="image/*"
										disabled={!canUpdate || updateMutation.isPending}
										onChange={async (e) => {
											const f = e.target.files?.[0];
											if (!f) return;
											try {
												const b64 = await fileToBase64(f);
												setDraft((p) => ({ ...p, [id]: b64 }));
												toast.success("已读取图片并写入配置值", { position: "top-center" });
											} catch {
												toast.error("读取图片失败", { position: "top-center" });
											} finally {
												e.target.value = "";
											}
										}}
									/>
									{preview && <img src={preview} alt="preview" className="h-10 w-10 rounded border object-contain" />}
								</div>
							)}
						</div>
					);
				},
			},
			{ title: "Description", dataIndex: "description" },
		],
		[canUpdate, draft, editMode, updateMutation.isPending],
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>Option</div>
					<div className="flex items-center gap-2">
						<Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-[160px]" />
						<Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (comma separated)" className="w-[240px]" />
						<Button
							onClick={() => {
								const categoryVal = category.trim();
								const codes = code
									.split(",")
									.map((x) => x.trim())
									.filter(Boolean);
								setQuery({
									category: categoryVal || undefined,
									code: codes.length ? codes : undefined,
								});
							}}
						>
							Search
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								setCategory("");
								setCode("");
								setQuery({});
							}}
						>
							Reset
						</Button>
						<Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["systemOption.list"] })}>
							Refresh
						</Button>
						{!editMode ? (
							<>
								<Button disabled={!canUpdate || !data?.length} onClick={() => setEditMode(true)}>
									修改
								</Button>
								<Button variant="secondary" disabled={!canUpdate || resetMutation.isPending} onClick={onResetValue}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button disabled={!canUpdate || updateMutation.isPending} onClick={onSave}>
									保存
								</Button>
								<Button variant="secondary" disabled={updateMutation.isPending} onClick={onResetDraft}>
									重置
								</Button>
								<Button variant="secondary" disabled={updateMutation.isPending} onClick={onCancel}>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Table<SysOption>
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					pagination={false}
					loading={isFetching}
					columns={columns}
					dataSource={data || []}
				/>
			</CardContent>
		</Card>
	);
}
