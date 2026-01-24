// 后端路由页面：系统管理-系统配置（对齐 pc-admin-vue3 的 /system/config 交互：同一路径按 tab 切换子配置）。

import systemClientService from "@/api/services/systemClientService";
import systemOptionService from "@/api/services/systemOptionService";
import systemStorageService from "@/api/services/systemStorageService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Form, Input as AntInput, InputNumber, Modal, Select, Switch, Tabs, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type {
	ClientQuery,
	ClientResp,
	ClientSaveReq,
	OptionResp,
	OptionUpdateReq,
	StorageResp,
	StorageSaveReq,
} from "#/system";

type TabKey = "site" | "security" | "login" | "storage" | "client";

type Props = {
	route?: BackendRouteItem;
	initialTab?: TabKey;
};

const fileToBase64 = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () => reject(new Error("读取文件失败"));
		reader.readAsDataURL(file);
	});

const mapOptions = (options: OptionResp[]) => {
	const map: Record<string, OptionResp> = {};
	for (const item of options) map[item.code] = item;
	return map;
};

function SiteConfigTab() {
	const { checkAny } = useAuthCheck("permission");
	const canUpdate = checkAny(["system:siteConfig:update"]);
	const [isUpdate, setIsUpdate] = useState(false);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.option.site"],
		queryFn: () => systemOptionService.listOption({ category: "SITE" }),
	});

	const optionMap = useMemo(() => mapOptions(data || []), [data]);
	const [form] = Form.useForm();

	const reset = () => {
		form.resetFields();
		form.setFieldsValue({
			SITE_LOGO: optionMap.SITE_LOGO?.value || "",
			SITE_FAVICON: optionMap.SITE_FAVICON?.value || "",
			SITE_TITLE: optionMap.SITE_TITLE?.value || "",
			SITE_DESCRIPTION: optionMap.SITE_DESCRIPTION?.value || "",
			SITE_COPYRIGHT: optionMap.SITE_COPYRIGHT?.value || "",
			SITE_BEIAN: optionMap.SITE_BEIAN?.value || "",
		});
	};

	useEffect(() => {
		if (data) reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data]);

	const uploadProps = (field: string): UploadProps => ({
		showUploadList: false,
		beforeUpload: async (file) => {
			const base64 = await fileToBase64(file as File);
			form.setFieldValue(field, base64);
			return false;
		},
	});

	const onSave = async () => {
		const values = (await form.validateFields()) as Record<string, any>;
		const payload: OptionUpdateReq[] = Object.entries(values)
			.filter(([code]) => optionMap[code]?.id)
			.map(([code, value]) => ({ id: optionMap[code].id, code, value }));
		await systemOptionService.updateOption(payload);
		toast.success("保存成功");
		setIsUpdate(false);
		await refetch();
	};

	const onResetDefault = () => {
		Modal.warning({
			title: "警告",
			content: "确认恢复网站配置为默认值吗？",
			okText: "确认",
			cancelText: "取消",
			onOk: async () => {
				await systemOptionService.resetOptionValue({ category: "SITE" });
				toast.success("恢复成功");
				await refetch();
			},
		});
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="font-semibold">网站配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button variant="outline" onClick={() => refetch()}>
									刷新
								</Button>
								<Button disabled={!canUpdate} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button disabled={!canUpdate} variant="outline" onClick={onResetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button onClick={onSave}>保存</Button>
								<Button variant="outline" onClick={reset}>
									重置
								</Button>
								<Button
									variant="outline"
									onClick={() => {
										reset();
										setIsUpdate(false);
									}}
								>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form form={form} layout="vertical" disabled={!isUpdate} className="grid grid-cols-1 gap-3">
					<Form.Item label="系统 Logo" name="SITE_LOGO">
						<div className="flex items-center gap-3">
							<Upload {...uploadProps("SITE_LOGO")}>
								<Button variant="outline" type="button" disabled={!isUpdate}>
									上传
								</Button>
							</Upload>
							<Form.Item noStyle shouldUpdate>
								{() => {
									const v = form.getFieldValue("SITE_LOGO");
									return v ? <img alt="logo" src={v} className="h-10 w-10 rounded" /> : <span className="text-xs text-text-secondary">未设置</span>;
								}}
							</Form.Item>
						</div>
					</Form.Item>
					<Form.Item label="系统 Favicon" name="SITE_FAVICON">
						<div className="flex items-center gap-3">
							<Upload {...uploadProps("SITE_FAVICON")}>
								<Button variant="outline" type="button" disabled={!isUpdate}>
									上传
								</Button>
							</Upload>
							<Form.Item noStyle shouldUpdate>
								{() => {
									const v = form.getFieldValue("SITE_FAVICON");
									return v ? <img alt="favicon" src={v} className="h-8 w-8 rounded" /> : <span className="text-xs text-text-secondary">未设置</span>;
								}}
							</Form.Item>
						</div>
					</Form.Item>
					<Form.Item label="系统名称" name="SITE_TITLE" rules={[{ required: true, message: "请输入系统名称" }]}>
						<AntInput maxLength={18} />
					</Form.Item>
					<Form.Item label="系统描述" name="SITE_DESCRIPTION" rules={[{ required: true, message: "请输入系统描述" }]}>
						<AntInput.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
					</Form.Item>
					<Form.Item label="版权声明" name="SITE_COPYRIGHT" rules={[{ required: true, message: "请输入版权声明" }]}>
						<AntInput />
					</Form.Item>
					<Form.Item label="备案号" name="SITE_BEIAN">
						<AntInput maxLength={30} />
					</Form.Item>
				</Form>
				{isFetching ? <div className="pt-2 text-xs text-text-secondary">加载中…</div> : null}
			</CardContent>
		</Card>
	);
}

function LoginConfigTab() {
	const { checkAny } = useAuthCheck("permission");
	const canUpdate = checkAny(["system:loginConfig:update"]);
	const [isUpdate, setIsUpdate] = useState(false);
	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.option.login"],
		queryFn: () => systemOptionService.listOption({ category: "LOGIN" }),
	});
	const optionMap = useMemo(() => mapOptions(data || []), [data]);
	const [form] = Form.useForm();

	useEffect(() => {
		form.setFieldsValue({
			LOGIN_CAPTCHA_ENABLED: Number(optionMap.LOGIN_CAPTCHA_ENABLED?.value ?? 1),
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data]);

	const reset = () => {
		form.setFieldsValue({
			LOGIN_CAPTCHA_ENABLED: Number(optionMap.LOGIN_CAPTCHA_ENABLED?.value ?? 1),
		});
	};

	const onSave = async () => {
		const values = (await form.validateFields()) as Record<string, any>;
		const payload: OptionUpdateReq[] = Object.entries(values)
			.filter(([code]) => optionMap[code]?.id)
			.map(([code, value]) => ({ id: optionMap[code].id, code, value }));
		await systemOptionService.updateOption(payload);
		toast.success("保存成功");
		setIsUpdate(false);
		await refetch();
	};

	const onResetDefault = () => {
		Modal.warning({
			title: "警告",
			content: "确认恢复登录配置为默认值吗？",
			okText: "确认",
			cancelText: "取消",
			onOk: async () => {
				await systemOptionService.resetOptionValue({ category: "LOGIN" });
				toast.success("恢复成功");
				await refetch();
			},
		});
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="font-semibold">登录配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button variant="outline" onClick={() => refetch()}>
									刷新
								</Button>
								<Button disabled={!canUpdate} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button disabled={!canUpdate} variant="outline" onClick={onResetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button onClick={onSave}>保存</Button>
								<Button variant="outline" onClick={reset}>
									重置
								</Button>
								<Button
									variant="outline"
									onClick={() => {
										reset();
										setIsUpdate(false);
									}}
								>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form form={form} layout="vertical" disabled={!isUpdate}>
					<Form.Item
						label="登录验证码开关"
						name="LOGIN_CAPTCHA_ENABLED"
						rules={[{ required: true, message: "请选择" }]}
						valuePropName="checked"
						getValueProps={(v) => ({ checked: Number(v) === 1 })}
						getValueFromEvent={(checked: boolean) => (checked ? 1 : 0)}
					>
						<Switch checkedChildren="是" unCheckedChildren="否" />
					</Form.Item>
				</Form>
				{isFetching ? <div className="pt-2 text-xs text-text-secondary">加载中…</div> : null}
			</CardContent>
		</Card>
	);
}

function SecurityConfigTab() {
	const { checkAny } = useAuthCheck("permission");
	const canUpdate = checkAny(["system:securityConfig:update"]);
	const [isUpdate, setIsUpdate] = useState(false);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.option.password"],
		queryFn: () => systemOptionService.listOption({ category: "PASSWORD" }),
	});

	const optionMap = useMemo(() => mapOptions(data || []), [data]);
	const [form] = Form.useForm();

	const reset = () => {
		form.setFieldsValue({
			PASSWORD_ERROR_LOCK_COUNT: Number(optionMap.PASSWORD_ERROR_LOCK_COUNT?.value ?? 0),
			PASSWORD_ERROR_LOCK_MINUTES: Number(optionMap.PASSWORD_ERROR_LOCK_MINUTES?.value ?? 0),
			PASSWORD_EXPIRATION_DAYS: Number(optionMap.PASSWORD_EXPIRATION_DAYS?.value ?? 0),
			PASSWORD_EXPIRATION_WARNING_DAYS: Number(optionMap.PASSWORD_EXPIRATION_WARNING_DAYS?.value ?? 0),
			PASSWORD_REPETITION_TIMES: Number(optionMap.PASSWORD_REPETITION_TIMES?.value ?? 0),
			PASSWORD_MIN_LENGTH: Number(optionMap.PASSWORD_MIN_LENGTH?.value ?? 0),
			PASSWORD_ALLOW_CONTAIN_USERNAME: Number(optionMap.PASSWORD_ALLOW_CONTAIN_USERNAME?.value ?? 0),
			PASSWORD_REQUIRE_SYMBOLS: Number(optionMap.PASSWORD_REQUIRE_SYMBOLS?.value ?? 0),
		});
	};

	useEffect(() => {
		if (data) reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data]);

	const onSave = async () => {
		const values = (await form.validateFields()) as Record<string, any>;
		const payload: OptionUpdateReq[] = Object.entries(values)
			.filter(([code]) => optionMap[code]?.id)
			.map(([code, value]) => ({ id: optionMap[code].id, code, value }));
		await systemOptionService.updateOption(payload);
		toast.success("保存成功");
		setIsUpdate(false);
		await refetch();
	};

	const onResetDefault = () => {
		Modal.warning({
			title: "警告",
			content: "确认恢复安全配置为默认值吗？",
			okText: "确认",
			cancelText: "取消",
			onOk: async () => {
				await systemOptionService.resetOptionValue({ category: "PASSWORD" });
				toast.success("恢复成功");
				await refetch();
			},
		});
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="font-semibold">安全配置</div>
					<div className="flex items-center gap-2">
						{!isUpdate ? (
							<>
								<Button variant="outline" onClick={() => refetch()}>
									刷新
								</Button>
								<Button disabled={!canUpdate} onClick={() => setIsUpdate(true)}>
									修改
								</Button>
								<Button disabled={!canUpdate} variant="outline" onClick={onResetDefault}>
									恢复默认
								</Button>
							</>
						) : (
							<>
								<Button onClick={onSave}>保存</Button>
								<Button variant="outline" onClick={reset}>
									重置
								</Button>
								<Button
									variant="outline"
									onClick={() => {
										reset();
										setIsUpdate(false);
									}}
								>
									取消
								</Button>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Form form={form} layout="vertical" disabled={!isUpdate} className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<Form.Item label="密码错误锁定次数" name="PASSWORD_ERROR_LOCK_COUNT" rules={[{ required: true, message: "请输入值" }]}>
						<InputNumber min={0} max={10} precision={0} />
					</Form.Item>
					<Form.Item label="密码错误锁定分钟数" name="PASSWORD_ERROR_LOCK_MINUTES" rules={[{ required: true, message: "请输入值" }]}>
						<InputNumber min={1} max={1440} precision={0} />
					</Form.Item>
					<Form.Item label="密码有效期(天)" name="PASSWORD_EXPIRATION_DAYS" rules={[{ required: true, message: "请输入值" }]}>
						<InputNumber min={0} max={999} precision={0} />
					</Form.Item>
					<Form.Item
						label="密码到期提醒(天)"
						name="PASSWORD_EXPIRATION_WARNING_DAYS"
						rules={[
							{ required: true, message: "请输入值" },
							() => ({
								validator: async (_, value) => {
									const expiration = Number(form.getFieldValue("PASSWORD_EXPIRATION_DAYS") ?? 0);
									if (expiration > 0 && Number(value) >= expiration) {
										throw new Error("密码到期提醒时间应小于密码有效期");
									}
								},
							}),
						]}
					>
						<InputNumber min={0} max={998} precision={0} />
					</Form.Item>
					<Form.Item label="历史密码重复次数" name="PASSWORD_REPETITION_TIMES" rules={[{ required: true, message: "请输入值" }]}>
						<InputNumber min={3} max={32} precision={0} />
					</Form.Item>
					<Form.Item label="密码最小长度" name="PASSWORD_MIN_LENGTH" rules={[{ required: true, message: "请输入值" }]}>
						<InputNumber min={8} max={32} precision={0} />
					</Form.Item>
					<Form.Item
						label="允许包含用户名"
						name="PASSWORD_ALLOW_CONTAIN_USERNAME"
						valuePropName="checked"
						getValueProps={(v) => ({ checked: Number(v) === 1 })}
						getValueFromEvent={(checked: boolean) => (checked ? 1 : 0)}
					>
						<Switch checkedChildren="是" unCheckedChildren="否" />
					</Form.Item>
					<Form.Item
						label="必须包含符号"
						name="PASSWORD_REQUIRE_SYMBOLS"
						valuePropName="checked"
						getValueProps={(v) => ({ checked: Number(v) === 1 })}
						getValueFromEvent={(checked: boolean) => (checked ? 1 : 0)}
					>
						<Switch checkedChildren="是" unCheckedChildren="否" />
					</Form.Item>
				</Form>
				{isFetching ? <div className="pt-2 text-xs text-text-secondary">加载中…</div> : null}
			</CardContent>
		</Card>
	);
}

function StorageConfigTab() {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:storage:create"]);
	const canUpdate = checkAny(["system:storage:update"]);
	const canDelete = checkAny(["system:storage:delete"]);
	const canUpdateStatus = checkAny(["system:storage:updateStatus"]);
	const canSetDefault = checkAny(["system:storage:setDefault"]);

	const [activeKey, setActiveKey] = useState<"all" | "1" | "2">("all");
	const [description, setDescription] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<StorageResp | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<StorageSaveReq>();

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.storage.list", activeKey, description],
		queryFn: () =>
			systemStorageService.listStorage({
				description: description || undefined,
				type: activeKey === "all" ? undefined : Number(activeKey),
			}),
	});

	const openAdd = () => {
		setEditing(null);
		form.resetFields();
		form.setFieldsValue({
			type: activeKey === "all" ? 1 : Number(activeKey),
			status: 1,
			sort: 999,
			isDefault: false,
			name: "",
			code: "",
			accessKey: "",
			secretKey: "",
			endpoint: "",
			region: "",
			bucketName: "",
			domain: "",
			description: "",
		});
		setModalOpen(true);
	};

	const openEdit = (row: StorageResp) => {
		setEditing(row);
		form.resetFields();
		form.setFieldsValue({
			name: row.name,
			code: row.code,
			type: row.type,
			accessKey: row.accessKey,
			secretKey: "",
			endpoint: row.endpoint,
			region: row.region,
			bucketName: row.bucketName,
			domain: row.domain,
			description: row.description,
			isDefault: row.isDefault,
			sort: row.sort,
			status: row.status,
		});
		setModalOpen(true);
	};

	const onSave = async () => {
		const values = await form.validateFields();
		setSaving(true);
		try {
			if (editing) {
				await systemStorageService.updateStorage(editing.id, values);
				toast.success("保存成功");
			} else {
				await systemStorageService.createStorage(values);
				toast.success("新增成功");
			}
			setModalOpen(false);
			await refetch();
		} finally {
			setSaving(false);
		}
	};

	const list = data || [];

	const columns = [
		{ title: "名称", dataIndex: "name", width: 200 },
		{ title: "编码", dataIndex: "code", width: 180 },
		{ title: "类型", dataIndex: "type", width: 90, render: (v: number) => (v === 1 ? "本地" : "对象") },
		{ title: "默认", dataIndex: "isDefault", width: 80, render: (v: boolean) => (v ? "是" : "否") },
		{ title: "状态", dataIndex: "status", width: 80, render: (v: number) => (v === 1 ? "启用" : "禁用") },
		{ title: "描述", dataIndex: "description", width: 220 },
		{ title: "创建时间", dataIndex: "createTime", width: 180 },
		{
			title: "操作",
			key: "op",
			width: 260,
			render: (_: any, record: StorageResp) => (
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" disabled={!canUpdate} onClick={() => openEdit(record)}>
						修改
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canSetDefault || record.isDefault}
						onClick={async () => {
							await systemStorageService.setDefaultStorage(record.id);
							toast.success("设置成功");
							refetch();
						}}
					>
						设为默认
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canUpdateStatus}
						onClick={async () => {
							await systemStorageService.updateStorageStatus(record.id, record.status === 1 ? 2 : 1);
							toast.success("更新成功");
							refetch();
						}}
					>
						{record.status === 1 ? "禁用" : "启用"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canDelete}
						onClick={() => {
							Modal.confirm({
								title: "确认删除",
								content: `是否确定删除存储「${record.name}」？`,
								okText: "删除",
								cancelText: "取消",
								okButtonProps: { danger: true },
								onOk: async () => {
									await systemStorageService.deleteStorage([record.id]);
									toast.success("删除成功");
									refetch();
								},
							});
						}}
					>
						删除
					</Button>
				</div>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="font-semibold">存储配置</div>
					<div className="flex items-center gap-2">
						<Input
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="搜索名称/编码"
							className="w-60"
						/>
						<Button variant="outline" onClick={() => refetch()}>
							刷新
						</Button>
						<Button disabled={!canCreate} onClick={openAdd}>
							新增
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Tabs
					activeKey={activeKey}
					onChange={(k) => setActiveKey(k as any)}
					items={[
						{ key: "all", label: "全部" },
						{ key: "1", label: "本地存储" },
						{ key: "2", label: "对象存储" },
					]}
				/>
				{/* 使用 antd Table 会引入较多样式，这里复用已在项目中使用的 Table 组件 */}
				{/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
				{(() => {
					const { Table } = require("antd") as typeof import("antd");
					return (
						<Table<StorageResp>
							rowKey="id"
							size="small"
							loading={isFetching}
							scroll={{ x: "max-content" }}
							columns={columns}
							dataSource={list}
							pagination={false}
						/>
					);
				})()}

				<Modal
					open={modalOpen}
					title={editing ? "修改存储" : "新增存储"}
					onCancel={() => setModalOpen(false)}
					onOk={onSave}
					confirmLoading={saving}
					okText="保存"
					cancelText="取消"
					width={720}
				>
					<Form form={form} layout="vertical">
						<Form.Item label="类型" name="type" rules={[{ required: true, message: "请选择类型" }]}>
							<Select
								options={[
									{ value: 1, label: "本地存储" },
									{ value: 2, label: "对象存储" },
								]}
							/>
						</Form.Item>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入名称" }]}>
								<AntInput />
							</Form.Item>
							<Form.Item label="编码" name="code" rules={[{ required: true, message: "请输入编码" }]}>
								<AntInput disabled={Boolean(editing)} />
							</Form.Item>
							<Form.Item label="AccessKey" name="accessKey">
								<AntInput />
							</Form.Item>
							<Form.Item noStyle shouldUpdate={(p, c) => p.type !== c.type}>
								{() => {
									const t = Number(form.getFieldValue("type") ?? 1);
									if (t !== 2) return null;
									return (
										<Form.Item label="SecretKey" name="secretKey">
											<AntInput.Password placeholder={editing ? "留空表示不修改" : ""} />
										</Form.Item>
									);
								}}
							</Form.Item>
							<Form.Item label="Endpoint" name="endpoint">
								<AntInput />
							</Form.Item>
							<Form.Item label="Region" name="region">
								<AntInput />
							</Form.Item>
							<Form.Item label="BucketName" name="bucketName">
								<AntInput />
							</Form.Item>
							<Form.Item label="Domain" name="domain">
								<AntInput />
							</Form.Item>
							<Form.Item label="排序" name="sort" rules={[{ required: true, message: "请输入排序" }]}>
								<InputNumber min={1} max={9999} precision={0} />
							</Form.Item>
							<Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
								<Select options={[{ value: 1, label: "启用" }, { value: 2, label: "禁用" }]} />
							</Form.Item>
						</div>
						<Form.Item label="描述" name="description">
							<AntInput.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
						</Form.Item>
						<Form.Item label="设为默认" name="isDefault" valuePropName="checked">
							<Switch checkedChildren="是" unCheckedChildren="否" />
						</Form.Item>
					</Form>
				</Modal>
			</CardContent>
		</Card>
	);
}

function ClientConfigTab() {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:client:create"]);
	const canGet = checkAny(["system:client:get"]);
	const canUpdate = checkAny(["system:client:update"]);
	const canDelete = checkAny(["system:client:delete"]);

	const [page, setPage] = useState(1);
	const [size, setSize] = useState(10);
	const [clientType, setClientType] = useState<string | undefined>(undefined);
	const [status, setStatus] = useState<number | undefined>(undefined);

	const [modalOpen, setModalOpen] = useState(false);
	const [detailOpen, setDetailOpen] = useState(false);
	const [current, setCurrent] = useState<ClientResp | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<ClientSaveReq>();

	const query: ClientQuery = { page, size, clientType, status, sort: ["id,desc"] };

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.client.page", query],
		queryFn: () => systemClientService.listClientPage(query),
	});

	const openAdd = () => {
		setCurrent(null);
		form.resetFields();
		form.setFieldsValue({
			clientType: "",
			authType: [],
			activeTimeout: 1800,
			timeout: 86400,
			status: 1,
		});
		setModalOpen(true);
	};

	const openEdit = async (row: ClientResp) => {
		const detail = await systemClientService.getClient(row.id);
		setCurrent(detail);
		form.resetFields();
		form.setFieldsValue({
			clientType: detail.clientType,
			authType: detail.authType,
			activeTimeout: detail.activeTimeout,
			timeout: detail.timeout,
			status: detail.status,
		});
		setModalOpen(true);
	};

	const openDetail = async (row: ClientResp) => {
		const detail = await systemClientService.getClient(row.id);
		setCurrent(detail);
		setDetailOpen(true);
	};

	const onSave = async () => {
		const values = await form.validateFields();
		setSaving(true);
		try {
			if (current) {
				await systemClientService.updateClient(current.id, values);
				toast.success("保存成功");
			} else {
				await systemClientService.createClient(values);
				toast.success("新增成功");
			}
			setModalOpen(false);
			await refetch();
		} finally {
			setSaving(false);
		}
	};

	const columns = [
		{ title: "客户端ID", dataIndex: "clientId", width: 260 },
		{ title: "客户端类型", dataIndex: "clientType", width: 140 },
		{
			title: "认证类型",
			dataIndex: "authType",
			width: 220,
			render: (v: string[]) => v?.join(", ") || "-",
		},
		{ title: "最低活跃频率(s)", dataIndex: "activeTimeout", width: 160, align: "center" as const },
		{ title: "Token有效期(s)", dataIndex: "timeout", width: 160, align: "center" as const },
		{ title: "状态", dataIndex: "status", width: 80, render: (v: number) => (v === 1 ? "启用" : "禁用") },
		{ title: "创建时间", dataIndex: "createTime", width: 180 },
		{
			title: "操作",
			key: "op",
			width: 200,
			render: (_: any, record: ClientResp) => (
				<div className="flex gap-2">
					<Button variant="outline" size="sm" disabled={!canGet} onClick={() => openDetail(record)}>
						详情
					</Button>
					<Button variant="outline" size="sm" disabled={!canUpdate} onClick={() => openEdit(record)}>
						修改
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canDelete}
						onClick={() => {
							Modal.confirm({
								title: "确认删除",
								content: `是否确定删除客户端「${record.clientId}」？`,
								okText: "删除",
								cancelText: "取消",
								okButtonProps: { danger: true },
								onOk: async () => {
									await systemClientService.deleteClient([record.id]);
									toast.success("删除成功");
									refetch();
								},
							});
						}}
					>
						删除
					</Button>
				</div>
			),
		},
	];

	const list = data?.list || [];
	const total = data?.total || 0;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="font-semibold">客户端配置</div>
					<div className="flex items-center gap-2">
						<Select
							allowClear
							placeholder="客户端类型"
							style={{ width: 160 }}
							value={clientType}
							onChange={(v) => {
								setClientType(v || undefined);
								setPage(1);
							}}
							options={[
								{ value: "PC", label: "PC" },
								{ value: "MOBILE", label: "MOBILE" },
							]}
						/>
						<Select
							allowClear
							placeholder="状态"
							style={{ width: 120 }}
							value={status}
							onChange={(v) => {
								setStatus(v ?? undefined);
								setPage(1);
							}}
							options={[
								{ value: 1, label: "启用" },
								{ value: 2, label: "禁用" },
							]}
						/>
						<Button variant="outline" onClick={() => refetch()}>
							刷新
						</Button>
						<Button disabled={!canCreate} onClick={openAdd}>
							新增
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
				{(() => {
					const { Table } = require("antd") as typeof import("antd");
					return (
						<Table<ClientResp>
							rowKey="id"
							size="small"
							loading={isFetching}
							scroll={{ x: "max-content" }}
							columns={columns}
							dataSource={list}
							pagination={{
								current: page,
								pageSize: size,
								total,
								showSizeChanger: true,
								onChange: (p, s) => {
									setPage(p);
									setSize(s);
								},
							}}
						/>
					);
				})()}

				<Modal
					open={modalOpen}
					title={current ? "修改客户端" : "新增客户端"}
					onCancel={() => setModalOpen(false)}
					onOk={onSave}
					confirmLoading={saving}
					okText="保存"
					cancelText="取消"
					width={680}
				>
					<Form form={form} layout="vertical">
						<Form.Item label="客户端类型" name="clientType" rules={[{ required: true, message: "请输入客户端类型" }]}>
							<AntInput placeholder="例如 PC" />
						</Form.Item>
						<Form.Item label="认证类型" name="authType" rules={[{ required: true, message: "请选择认证类型" }]}>
							<Select
								mode="multiple"
								placeholder="例如 ACCOUNT"
								options={[
									{ value: "ACCOUNT", label: "ACCOUNT" },
									{ value: "EMAIL", label: "EMAIL" },
									{ value: "SOCIAL", label: "SOCIAL" },
								]}
							/>
						</Form.Item>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<Form.Item label="最低活跃频率(秒)" name="activeTimeout" rules={[{ required: true, message: "请输入值" }]}>
								<InputNumber min={1} precision={0} />
							</Form.Item>
							<Form.Item label="Token有效期(秒)" name="timeout" rules={[{ required: true, message: "请输入值" }]}>
								<InputNumber min={1} precision={0} />
							</Form.Item>
							<Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
								<Select options={[{ value: 1, label: "启用" }, { value: 2, label: "禁用" }]} />
							</Form.Item>
						</div>
					</Form>
				</Modal>

				<Modal open={detailOpen} title="客户端详情" footer={null} onCancel={() => setDetailOpen(false)} width={680}>
					<div className="space-y-2 text-sm">
						<div>客户端ID：{current?.clientId}</div>
						<div>客户端类型：{current?.clientType}</div>
						<div>认证类型：{current?.authType?.join(", ")}</div>
						<div>最低活跃频率：{current?.activeTimeout} 秒</div>
						<div>Token有效期：{current?.timeout} 秒</div>
						<div>状态：{current?.status === 1 ? "启用" : "禁用"}</div>
						<div>创建时间：{current?.createTime}</div>
						<div>修改时间：{current?.updateTime}</div>
					</div>
				</Modal>
			</CardContent>
		</Card>
	);
}

export default function BackendSystemConfigPage({ route, initialTab }: Props) {
	const { checkAny } = useAuthCheck("permission");
	const location = useLocation();
	const navigate = useNavigate();

	const search = new URLSearchParams(location.search);
	const tabFromQuery = (search.get("tab") || undefined) as TabKey | undefined;

	const allTabs = useMemo(
		() =>
			[
				{ key: "site" as const, name: "网站配置", perms: ["system:siteConfig:get"] as const, node: <SiteConfigTab /> },
				{
					key: "security" as const,
					name: "安全配置",
					perms: ["system:securityConfig:get"] as const,
					node: <SecurityConfigTab />,
				},
				{ key: "login" as const, name: "登录配置", perms: ["system:loginConfig:get"] as const, node: <LoginConfigTab /> },
				{
					key: "storage" as const,
					name: "存储配置",
					perms: ["system:storage:list"] as const,
					node: <StorageConfigTab />,
				},
				{
					key: "client" as const,
					name: "客户端配置",
					perms: ["system:client:list"] as const,
					node: <ClientConfigTab />,
				},
			].filter((t) => checkAny([...t.perms])),
		[checkAny],
	);

	const active = useMemo<TabKey | undefined>(() => {
		const allowedKeys = new Set(allTabs.map((t) => t.key));
		if (tabFromQuery && allowedKeys.has(tabFromQuery)) return tabFromQuery;
		if (initialTab && allowedKeys.has(initialTab)) return initialTab;
		return allTabs[0]?.key;
	}, [allTabs, tabFromQuery, initialTab]);

	const activeNode = allTabs.find((t) => t.key === active)?.node;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="flex flex-col">
						<div className="text-base font-semibold">系统配置</div>
						{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{allTabs.length ? (
					<>
						<Tabs
							activeKey={active}
							onChange={(k) => {
								const next = k as TabKey;
								const nextSearch = new URLSearchParams(location.search);
								nextSearch.set("tab", next);
								navigate({ pathname: location.pathname, search: `?${nextSearch.toString()}` }, { replace: true });
							}}
							items={allTabs.map((t) => ({ key: t.key, label: t.name }))}
						/>
						<div className="pt-3">{activeNode}</div>
					</>
				) : (
					<div className="text-sm text-text-secondary">无可用配置项权限。</div>
				)}
			</CardContent>
		</Card>
	);
}
