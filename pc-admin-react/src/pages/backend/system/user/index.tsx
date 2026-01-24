// 后端路由页面：系统管理-用户管理（对齐 pc-admin-vue3：部门树筛选 + 列表 + 新增/导入/导出 + 详情/修改/删除/重置密码/分配角色）。

import systemDeptService from "@/api/services/systemDeptService";
import systemRoleService from "@/api/services/systemRoleService";
import systemUserService from "@/api/services/systemUserService";
import { useAuthCheck } from "@/components/auth/use-auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { useQuery } from "@tanstack/react-query";
import { DatePicker, Drawer, Dropdown, Form, Modal, Select, Table, Tree, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { BackendRouteItem } from "#/backend";
import type { DeptResp, RoleResp, SystemUserCreateReq, SystemUserResp, SystemUserUpdateReq } from "#/system";

const { RangePicker } = DatePicker;

const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const treeToNodes = (list: DeptResp[]): DataNode[] =>
	list.map((d) => ({
		key: d.id,
		title: d.name,
		children: d.children?.length ? treeToNodes(d.children) : undefined,
	}));

export default function BackendSystemUserPage({ route }: { route?: BackendRouteItem }) {
	const { checkAny } = useAuthCheck("permission");
	const canCreate = checkAny(["system:user:create"]);
	const canImport = checkAny(["system:user:import"]);
	const canExport = checkAny(["system:user:export"]);
	const canGet = checkAny(["system:user:get"]);
	const canUpdate = checkAny(["system:user:update"]);
	const canDelete = checkAny(["system:user:delete"]);
	const canResetPwd = checkAny(["system:user:resetPwd"]);
	const canUpdateRole = checkAny(["system:user:updateRole"]);

	const [page, setPage] = useState(1);
	const [size, setSize] = useState(10);
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<number | undefined>(undefined);
	const [createTime, setCreateTime] = useState<[string, string] | undefined>(undefined);
	const [deptId, setDeptId] = useState<number | undefined>(undefined);
	const [deptSearch, setDeptSearch] = useState("");

	const deptQuery = useQuery({
		queryKey: ["system.dept.tree"],
		queryFn: () => systemDeptService.listDeptTree(),
	});
	const deptTree = deptQuery.data || [];

	const roleQuery = useQuery({
		queryKey: ["system.role.list"],
		queryFn: () => systemRoleService.listRole(),
	});
	const roles = roleQuery.data || [];

	const deptNodes = useMemo(() => treeToNodes(deptTree), [deptTree]);

	const filteredDeptNodes = useMemo(() => {
		const keyword = deptSearch.trim().toLowerCase();
		if (!keyword) return deptNodes;
		const filter = (nodes: DataNode[]): DataNode[] =>
			nodes
				.map((n) => {
					const title = String(n.title || "").toLowerCase();
					const children = n.children ? filter(n.children) : [];
					if (title.includes(keyword) || children.length) return { ...n, children: children.length ? children : undefined };
					return null;
				})
				.filter(Boolean) as DataNode[];
		return filter(deptNodes);
	}, [deptNodes, deptSearch]);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["system.user.page", page, size, description, status, createTime, deptId],
		queryFn: () =>
			systemUserService.listUserPage({
				page,
				size,
				description: description || undefined,
				status,
				deptId,
				createTime: createTime ? [createTime[0], createTime[1]] : undefined,
				sort: ["t1.id,desc"],
			}),
	});

	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerMode, setDrawerMode] = useState<"add" | "edit" | "detail">("add");
	const [current, setCurrent] = useState<SystemUserResp | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<SystemUserCreateReq | SystemUserUpdateReq>();

	const openAdd = () => {
		setDrawerMode("add");
		setCurrent(null);
		form.resetFields();
		form.setFieldsValue({
			username: "",
			nickname: "",
			password: "",
			gender: 0,
			email: "",
			phone: "",
			avatar: "",
			description: "",
			status: 1,
			deptId: deptId || 0,
			roleIds: [],
		} as any);
		setDrawerOpen(true);
	};

	const openDetail = async (row: SystemUserResp) => {
		setDrawerMode("detail");
		const detail = await systemUserService.getUserDetail(row.id);
		setCurrent(detail);
		setDrawerOpen(true);
	};

	const openEdit = async (row: SystemUserResp) => {
		setDrawerMode("edit");
		const detail = await systemUserService.getUserDetail(row.id);
		setCurrent(detail);
		form.resetFields();
		form.setFieldsValue({
			username: detail.username,
			nickname: detail.nickname,
			gender: detail.gender,
			email: detail.email,
			phone: detail.phone,
			avatar: detail.avatar,
			description: detail.description,
			status: detail.status,
			deptId: detail.deptId,
			roleIds: detail.roleIds,
		} as any);
		setDrawerOpen(true);
	};

	const onDelete = (row: SystemUserResp) => {
		Modal.confirm({
			title: "确认删除",
			content: `是否确定删除用户「${row.nickname}(${row.username})」？`,
			okText: "删除",
			cancelText: "取消",
			okButtonProps: { danger: true },
			onOk: async () => {
				await systemUserService.deleteUser([row.id]);
				toast.success("删除成功");
				refetch();
			},
		});
	};

	const onResetPwd = (row: SystemUserResp) => {
		let newPassword = "";
		Modal.confirm({
			title: "重置密码",
			content: (
				<div className="space-y-2">
					<div className="text-sm text-text-secondary">为用户「{row.nickname || row.username}」设置新密码</div>
					<input
						className="w-full border rounded px-3 py-2"
						type="password"
						onChange={(e) => {
							newPassword = e.target.value;
						}}
					/>
				</div>
			),
			okText: "确认",
			cancelText: "取消",
			onOk: async () => {
				if (!newPassword) {
					toast.error("请输入新密码");
					throw new Error("missing");
				}
				await systemUserService.resetPassword(row.id, { newPassword });
				toast.success("重置成功");
			},
		});
	};

	const onUpdateRole = async (row: SystemUserResp) => {
		const detail = await systemUserService.getUserDetail(row.id);
		let roleIds: number[] = detail.roleIds || [];
		Modal.confirm({
			title: "分配角色",
			content: (
				<div className="space-y-2">
					<div className="text-sm text-text-secondary">为用户「{detail.nickname || detail.username}」分配角色</div>
					<Select
						mode="multiple"
						style={{ width: "100%" }}
						defaultValue={roleIds}
						options={roles.map((r) => ({ value: r.id, label: `${r.name}(${r.code})` }))}
						onChange={(v) => {
							roleIds = (v as number[]) || [];
						}}
					/>
				</div>
			),
			okText: "保存",
			cancelText: "取消",
			onOk: async () => {
				await systemUserService.updateUserRole(detail.id, { roleIds });
				toast.success("保存成功");
				refetch();
			},
		});
	};

	const exportUsers = async () => {
		const res = await systemUserService.exportUser({
			description: description || undefined,
			status,
			deptId,
			createTime: createTime ? [createTime[0], createTime[1]] : undefined,
		});
		const cd = String(res.headers?.["content-disposition"] || "");
		const fallbackName = "users.csv";
		const filename = cd.includes("filename=") ? cd.split("filename=")[1].replaceAll("\"", "") : fallbackName;
		downloadBlob(res.data, filename);
	};

	const downloadTemplate = async () => {
		const res = await systemUserService.downloadImportTemplate();
		downloadBlob(res.data, "user_import_template.csv");
	};

	const [importOpen, setImportOpen] = useState(false);
	const [importFile, setImportFile] = useState<File | null>(null);
	const [importParsing, setImportParsing] = useState(false);
	const [importParsed, setImportParsed] = useState<any>(null);
	const [importPolicy, setImportPolicy] = useState({
		duplicateUser: 1,
		duplicateEmail: 1,
		duplicatePhone: 1,
		defaultStatus: 1,
	});

	const parseImport = async () => {
		if (!importFile) return;
		setImportParsing(true);
		try {
			const parsed = await systemUserService.parseImportUser(importFile);
			setImportParsed(parsed);
			toast.success("解析成功");
		} finally {
			setImportParsing(false);
		}
	};

	const doImport = async () => {
		const result = await systemUserService.importUser({
			importKey: importParsed?.importKey,
			errorPolicy: 1,
			duplicateUser: importPolicy.duplicateUser,
			duplicateEmail: importPolicy.duplicateEmail,
			duplicatePhone: importPolicy.duplicatePhone,
			defaultStatus: importPolicy.defaultStatus,
		});
		toast.success(`导入完成：新增 ${result.insertRows}，更新 ${result.updateRows}`);
		setImportOpen(false);
		setImportFile(null);
		setImportParsed(null);
		refetch();
	};

	const onSave = async () => {
		const values = await form.validateFields();
		setSaving(true);
		try {
			if (drawerMode === "add") {
				await systemUserService.createUser(values as SystemUserCreateReq);
				toast.success("新增成功");
			} else if (drawerMode === "edit" && current) {
				await systemUserService.updateUser(current.id, values as SystemUserUpdateReq);
				toast.success("保存成功");
			}
			setDrawerOpen(false);
			refetch();
		} finally {
			setSaving(false);
		}
	};

	const columns: ColumnsType<SystemUserResp> = [
		{
			title: "昵称",
			dataIndex: "nickname",
			width: 160,
			fixed: "left",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					{record.avatar ? <img alt="" src={record.avatar} className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-bg-neutral" />}
					<div className="flex flex-col">
						<span className="text-sm">{record.nickname}</span>
						<span className="text-xs text-text-secondary">{record.username}</span>
					</div>
				</div>
			),
		},
		{ title: "状态", dataIndex: "status", width: 100, align: "center", render: (v) => (v === 1 ? "启用" : "禁用") },
		{ title: "性别", dataIndex: "gender", width: 80, align: "center", render: (v) => (v === 1 ? "男" : v === 2 ? "女" : "未知") },
		{ title: "所属部门", dataIndex: "deptName", width: 180 },
		{ title: "角色", dataIndex: "roleNames", width: 220, render: (v) => (v?.length ? v.join(", ") : "-") },
		{ title: "手机号", dataIndex: "phone", width: 160 },
		{ title: "邮箱", dataIndex: "email", width: 200 },
		{ title: "描述", dataIndex: "description", width: 200 },
		{ title: "创建时间", dataIndex: "createTime", width: 180 },
		{ title: "修改时间", dataIndex: "updateTime", width: 180 },
		{
			title: "操作",
			key: "op",
			width: 220,
			fixed: "right",
			render: (_, record) => (
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" disabled={!canGet} onClick={() => openDetail(record)}>
						详情
					</Button>
					<Button variant="outline" size="sm" disabled={!canUpdate} onClick={() => openEdit(record)}>
						修改
					</Button>
					<Button variant="outline" size="sm" disabled={!canDelete || record.isSystem} onClick={() => onDelete(record)}>
						删除
					</Button>
					<Dropdown
						menu={{
							items: [
								canResetPwd ? { key: "resetPwd", label: "重置密码" } : null,
								canUpdateRole ? { key: "updateRole", label: "分配角色" } : null,
							].filter(Boolean) as any,
							onClick: ({ key }) => {
								if (key === "resetPwd") onResetPwd(record);
								if (key === "updateRole") onUpdateRole(record);
							},
						}}
					>
						<Button variant="ghost" size="sm" disabled={!canResetPwd && !canUpdateRole}>
							更多
						</Button>
					</Dropdown>
				</div>
			),
		},
	];

	useEffect(() => {
		if (deptTree.length && deptId === undefined) {
			setDeptId(deptTree[0].id);
		}
	}, [deptTree, deptId]);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
			<Card className="h-full">
				<CardHeader>
					<div className="font-semibold">部门</div>
				</CardHeader>
				<CardContent className="space-y-2">
					<Input value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} placeholder="搜索部门名称" />
					<Tree
						showLine
						defaultExpandAll
						selectedKeys={deptId ? [deptId] : []}
						treeData={filteredDeptNodes}
						onSelect={(keys) => {
							const next = keys?.[0] ? Number(keys[0]) : undefined;
							setDeptId(next);
							setPage(1);
						}}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<div className="text-base font-semibold">用户管理</div>
							{route?.permission ? <div className="text-xs text-text-secondary">权限码：{route.permission}</div> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button disabled={!canCreate} onClick={openAdd}>
								新增
							</Button>
							<Button disabled={!canImport} variant="outline" onClick={() => setImportOpen(true)}>
								导入
							</Button>
							<Button disabled={!canExport} variant="outline" onClick={exportUsers}>
								导出
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="用户名/昵称/描述" className="w-60" />
						<Select
							allowClear
							placeholder="状态"
							style={{ width: 140 }}
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
						<RangePicker
							showTime
							allowEmpty={[true, true]}
							onChange={(v) => {
								if (!v?.[0] || !v?.[1]) {
									setCreateTime(undefined);
									return;
								}
								setCreateTime([v[0].format("YYYY-MM-DD HH:mm:ss"), v[1].format("YYYY-MM-DD HH:mm:ss")]);
								setPage(1);
							}}
						/>
						<Button variant="outline" onClick={() => refetch()}>
							刷新
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setDescription("");
								setStatus(undefined);
								setCreateTime(undefined);
								setPage(1);
								refetch();
							}}
						>
							重置
						</Button>
					</div>

					<Table<SystemUserResp>
						rowKey="id"
						size="small"
						loading={isFetching}
						scroll={{ x: "max-content" }}
						columns={columns}
						dataSource={data?.list || []}
						pagination={{
							current: page,
							pageSize: size,
							total: data?.total || 0,
							showSizeChanger: true,
							onChange: (nextPage, nextSize) => {
								setPage(nextPage);
								setSize(nextSize);
							},
						}}
					/>
				</CardContent>
			</Card>

			<Drawer
				open={drawerOpen}
				title={drawerMode === "add" ? "新增用户" : drawerMode === "edit" ? "修改用户" : "用户详情"}
				onClose={() => setDrawerOpen(false)}
				width={520}
				footer={
					drawerMode === "detail" ? null : (
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setDrawerOpen(false)}>
								取消
							</Button>
							<Button onClick={onSave} disabled={saving}>
								保存
							</Button>
						</div>
					)
				}
			>
				{drawerMode === "detail" && current ? (
					<div className="space-y-2 text-sm">
						<div>ID：{current.id}</div>
						<div>用户名：{current.username}</div>
						<div>昵称：{current.nickname}</div>
						<div>性别：{current.gender === 1 ? "男" : current.gender === 2 ? "女" : "未知"}</div>
						<div>状态：{current.status === 1 ? "启用" : "禁用"}</div>
						<div>邮箱：{current.email}</div>
						<div>手机号：{current.phone}</div>
						<div>部门：{current.deptName}</div>
						<div>角色：{current.roleNames?.join(", ")}</div>
						<div>描述：{current.description}</div>
						{current.pwdResetTime ? <div>密码重置时间：{current.pwdResetTime}</div> : null}
						{current.createUserString ? <div>创建人：{current.createUserString}</div> : null}
						<div>创建时间：{current.createTime}</div>
						{current.updateUserString ? <div>修改人：{current.updateUserString}</div> : null}
						<div>修改时间：{current.updateTime}</div>
					</div>
				) : (
					<Form form={form} layout="vertical" disabled={drawerMode === "detail"}>
						<Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
							<input className="w-full border rounded px-3 py-2" disabled={drawerMode === "edit"} />
						</Form.Item>
						<Form.Item label="昵称" name="nickname" rules={[{ required: true, message: "请输入昵称" }]}>
							<input className="w-full border rounded px-3 py-2" />
						</Form.Item>
						{drawerMode === "add" ? (
							<Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
								<input className="w-full border rounded px-3 py-2" type="password" />
							</Form.Item>
						) : null}
						<Form.Item label="性别" name="gender">
							<Select
								options={[
									{ value: 0, label: "未知" },
									{ value: 1, label: "男" },
									{ value: 2, label: "女" },
								]}
							/>
						</Form.Item>
						<Form.Item label="邮箱" name="email">
							<input className="w-full border rounded px-3 py-2" />
						</Form.Item>
						<Form.Item label="手机号" name="phone">
							<input className="w-full border rounded px-3 py-2" />
						</Form.Item>
						<Form.Item label="头像URL" name="avatar">
							<input className="w-full border rounded px-3 py-2" />
						</Form.Item>
						<Form.Item label="部门" name="deptId">
							<Select
								options={(() => {
									const flat: DeptResp[] = [];
									const walk = (arr: DeptResp[]) => {
										for (const n of arr) {
											flat.push(n);
											if (n.children?.length) walk(n.children);
										}
									};
									walk(deptTree);
									return flat.map((d) => ({ value: d.id, label: d.name }));
								})()}
							/>
						</Form.Item>
						<Form.Item label="角色" name="roleIds">
							<Select mode="multiple" options={roles.map((r: RoleResp) => ({ value: r.id, label: `${r.name}(${r.code})` }))} />
						</Form.Item>
						<Form.Item label="状态" name="status">
							<Select options={[{ value: 1, label: "启用" }, { value: 2, label: "禁用" }]} />
						</Form.Item>
						<Form.Item label="描述" name="description">
							<textarea className="w-full border rounded px-3 py-2" rows={3} />
						</Form.Item>
					</Form>
				)}
			</Drawer>

			<Modal
				open={importOpen}
				title="导入用户"
				onCancel={() => {
					setImportOpen(false);
					setImportFile(null);
					setImportParsed(null);
					setImportPolicy({ duplicateUser: 1, duplicateEmail: 1, duplicatePhone: 1, defaultStatus: 1 });
				}}
				okText={importParsed ? "导入" : "解析"}
				cancelText="取消"
				confirmLoading={importParsing}
				onOk={async () => {
					if (!importParsed) {
						await parseImport();
						return;
					}
					await doImport();
				}}
			>
				<div className="space-y-3">
					<div className="rounded border p-3 text-sm text-text-secondary">
						<div>请先下载模板并按要求填写数据；上传后点击“解析”获取统计，再设置导入策略并点击“导入”。</div>
						<div className="pt-2">
							<Button variant="outline" onClick={downloadTemplate}>
								下载模板
							</Button>
						</div>
					</div>
					<Upload
						maxCount={1}
						accept=".csv,.xlsx"
						beforeUpload={(file) => {
							setImportFile(file as any);
							setImportParsed(null);
							return false;
						}}
					>
						<Button variant="outline">选择文件</Button>
					</Upload>
					{importFile ? <div className="text-sm">已选择：{importFile.name}</div> : <div className="text-sm text-text-secondary">请选择文件后点击解析</div>}
					{importParsed ? (
						<div className="text-sm space-y-1">
							<div>解析Key：{importParsed.importKey}</div>
							<div>总行数：{importParsed.totalRows}</div>
							<div>有效行：{importParsed.validRows}</div>
							<div>已存在用户：{importParsed.duplicateUserRows}</div>
							<div>已存在邮箱：{importParsed.duplicateEmailRows}</div>
							<div>已存在手机：{importParsed.duplicatePhoneRows}</div>
						</div>
					) : null}
					<div className="rounded border p-3 space-y-3">
						<div className="text-sm font-semibold">导入策略</div>
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between gap-3">
								<div className="text-text-secondary">用户已存在</div>
								<Select
									style={{ width: 200 }}
									value={importPolicy.duplicateUser}
									onChange={(v) => setImportPolicy((p) => ({ ...p, duplicateUser: Number(v) }))}
									options={[
										{ value: 1, label: "跳过该行" },
										{ value: 3, label: "停止导入" },
										{ value: 2, label: "修改数据" },
									]}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<div className="text-text-secondary">邮箱已存在</div>
								<Select
									style={{ width: 200 }}
									value={importPolicy.duplicateEmail}
									onChange={(v) => setImportPolicy((p) => ({ ...p, duplicateEmail: Number(v) }))}
									options={[
										{ value: 1, label: "跳过该行" },
										{ value: 3, label: "停止导入" },
									]}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<div className="text-text-secondary">手机已存在</div>
								<Select
									style={{ width: 200 }}
									value={importPolicy.duplicatePhone}
									onChange={(v) => setImportPolicy((p) => ({ ...p, duplicatePhone: Number(v) }))}
									options={[
										{ value: 1, label: "跳过该行" },
										{ value: 3, label: "停止导入" },
									]}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<div className="text-text-secondary">默认状态</div>
								<Select
									style={{ width: 200 }}
									value={importPolicy.defaultStatus}
									onChange={(v) => setImportPolicy((p) => ({ ...p, defaultStatus: Number(v) }))}
									options={[
										{ value: 1, label: "启用" },
										{ value: 2, label: "禁用" },
									]}
								/>
							</div>
						</div>
					</div>
				</div>
			</Modal>
		</div>
	);
}
