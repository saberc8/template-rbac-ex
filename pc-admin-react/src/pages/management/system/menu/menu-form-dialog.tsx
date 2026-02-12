import { TreeSelect } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BasicStatus } from "#/enum";
import type { SysMenuNode, SysMenuSaveReq } from "@/api/services/systemMenuService";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Switch } from "@/ui/switch";

const collectDescendantIds = (root: SysMenuNode | null): Set<string> => {
	const ids = new Set<string>();
	if (!root) return ids;
	const walk = (n: SysMenuNode) => {
		ids.add(String(n.id));
		for (const ch of n.children || []) walk(ch);
	};
	walk(root);
	return ids;
};

const findNode = (nodes: SysMenuNode[], id: string): SysMenuNode | null => {
	for (const n of nodes) {
		if (String(n.id) === String(id)) return n;
		const found = n.children ? findNode(n.children, String(id)) : null;
		if (found) return found;
	}
	return null;
};

type MenuFormMode = "create" | "update";

export default function MenuFormDialog({
	open,
	mode,
	tree,
	initial,
	defaultParentId,
	onOpenChange,
	onSubmit,
	busy,
}: {
	open: boolean;
	mode: MenuFormMode;
	tree: SysMenuNode[];
	initial: SysMenuNode | null;
	defaultParentId?: string;
	busy?: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: SysMenuSaveReq) => Promise<void> | void;
}) {
	const { t } = useTranslation();
	const [type, setType] = useState<number>(2);
	const [title, setTitle] = useState("");
	const [parentId, setParentId] = useState<string>("0");
	const [path, setPath] = useState("");
	const [name, setName] = useState("");
	const [component, setComponent] = useState("");
	const [redirect, setRedirect] = useState("");
	const [icon, setIcon] = useState("");
	const [permission, setPermission] = useState("");
	const [sort, setSort] = useState<number>(1);
	const [status, setStatus] = useState<number>(BasicStatus.ENABLE);
	const [isExternal, setIsExternal] = useState(false);
	const [isCache, setIsCache] = useState(false);
	const [isHidden, setIsHidden] = useState(false);

	useEffect(() => {
		if (!open) return;

		if (mode === "update" && initial) {
			setType(Number(initial.type) || 1);
			setTitle(initial.title || "");
			setParentId(String(initial.parentId ?? "0"));
			setPath(initial.path || "");
			setName(initial.name || "");
			setComponent(initial.component || "");
			setRedirect(initial.redirect || "");
			setIcon(initial.icon || "");
			setPermission(initial.permission || "");
			setSort(Number(initial.sort) || 1);
			setStatus(Number(initial.status) || BasicStatus.ENABLE);
			setIsExternal(Boolean(initial.isExternal));
			setIsCache(Boolean(initial.isCache));
			setIsHidden(Boolean(initial.isHidden));
			return;
		}

		setType(2);
		setTitle("");
		setParentId(String(defaultParentId ?? "0"));
		setPath("");
		setName("");
		setComponent("");
		setRedirect("");
		setIcon("");
		setPermission("");
		setSort(1);
		setStatus(BasicStatus.ENABLE);
		setIsExternal(false);
		setIsCache(false);
		setIsHidden(false);
	}, [defaultParentId, initial, mode, open]);

	const disabledParentIds = useMemo(() => {
		if (mode !== "update" || !initial) return new Set<string>();
		const node = findNode(tree, String(initial.id));
		return collectDescendantIds(node);
	}, [initial, mode, tree]);

	const translateTitle = useMemo(() => {
		return (value: string) => {
			const raw = String(value || "");
			if (!raw) return raw;
			const translated = t(raw);
			return translated === raw ? raw : translated;
		};
	}, [t]);

	const treeSelectData = useMemo(() => {
		const map = (nodes: SysMenuNode[]): any[] =>
			(nodes || []).map((n) => ({
				title: translateTitle(n.title),
				value: String(n.id),
				disabled: disabledParentIds.has(String(n.id)),
				children: map(n.children || []),
			}));
		return [
			{
				title: "根节点",
				value: "0",
				disabled: false,
				children: map(tree),
			},
		];
	}, [disabledParentIds, translateTitle, tree]);

	const isButton = type === 3;
	const isMenu = type === 2;

	const doSubmit = async () => {
		const titleVal = title.trim();
		if (!titleVal) {
			toast.error("标题不能为空", { position: "top-center" });
			return;
		}

		const payload: SysMenuSaveReq = {
			type: Number(type) || 1,
			icon: icon.trim(),
			title: titleVal,
			sort: Number(sort) || 1,
			permission: permission.trim(),
			path: path.trim(),
			name: name.trim(),
			component: component.trim(),
			redirect: redirect.trim(),
			isExternal: Boolean(isExternal),
			isCache: Boolean(isCache),
			isHidden: Boolean(isHidden),
			parentId: parentId || "0",
			status: Number(status) || BasicStatus.ENABLE,
		};

		if (isButton) {
			payload.path = "";
			payload.name = "";
			payload.component = "";
			payload.redirect = "";
			payload.isExternal = false;
			payload.isCache = false;
			payload.isHidden = Boolean(isHidden);
		}

		if (!isButton && !payload.path) {
			toast.error("路由地址不能为空", { position: "top-center" });
			return;
		}
		if (isMenu && !payload.isExternal && !payload.component) {
			toast.error("菜单类型需要填写组件", { position: "top-center" });
			return;
		}

		await onSubmit(payload);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{mode === "create" ? "新增菜单" : "编辑菜单"}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>类型</Label>
						<Select value={String(type)} onValueChange={(v) => setType(Number(v))}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">目录</SelectItem>
								<SelectItem value="2">菜单</SelectItem>
								<SelectItem value="3">按钮</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>上级菜单</Label>
						<TreeSelect
							className="w-full"
							treeData={treeSelectData}
							value={parentId}
							onChange={(v) => setParentId(String(v ?? "0"))}
							placeholder="请选择上级菜单"
							treeDefaultExpandAll
						/>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label>标题</Label>
						<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入标题" />
					</div>

					{!isButton && (
						<div className="space-y-2 md:col-span-2">
							<Label>路由地址</Label>
							<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="例如：/system/menu" />
						</div>
					)}

					{!isButton && (
						<div className="space-y-2">
							<Label>路由名称</Label>
							<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：SystemMenu" />
						</div>
					)}

					{!isButton && (
						<div className="space-y-2">
							<Label>组件</Label>
							<Input
								value={component}
								onChange={(e) => setComponent(e.target.value)}
								placeholder="例如：system/menu/index"
							/>
						</div>
					)}

					{!isButton && (
						<div className="space-y-2">
							<Label>重定向</Label>
							<Input value={redirect} onChange={(e) => setRedirect(e.target.value)} placeholder="例如：/system/user" />
						</div>
					)}

					<div className="space-y-2">
						<Label>权限标识</Label>
						<Input
							value={permission}
							onChange={(e) => setPermission(e.target.value)}
							placeholder="例如：system:menu:create"
						/>
					</div>

					<div className="space-y-2">
						<Label>图标</Label>
						<Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="例如：menu" />
					</div>

					<div className="space-y-2">
						<Label>排序</Label>
						<Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} />
					</div>

					<div className="space-y-2">
						<Label>状态</Label>
						<Select value={String(status)} onValueChange={(v) => setStatus(Number(v))}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={String(BasicStatus.ENABLE)}>启用</SelectItem>
								<SelectItem value={String(BasicStatus.DISABLE)}>禁用</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{!isButton && (
						<div className="flex items-center gap-2 md:col-span-2">
							<Switch checked={isExternal} onCheckedChange={setIsExternal} />
							<span className="text-sm text-muted-foreground">外链</span>
						</div>
					)}

					{!isButton && (
						<div className="flex flex-wrap items-center gap-4 md:col-span-2">
							<div className="flex items-center gap-2">
								<Switch checked={isCache} onCheckedChange={setIsCache} />
								<span className="text-sm text-muted-foreground">缓存</span>
							</div>
							<div className="flex items-center gap-2">
								<Switch checked={isHidden} onCheckedChange={setIsHidden} />
								<span className="text-sm text-muted-foreground">隐藏</span>
							</div>
						</div>
					)}

					{isButton && (
						<div className="flex items-center gap-2 md:col-span-2">
							<Switch checked={isHidden} onCheckedChange={setIsHidden} />
							<span className="text-sm text-muted-foreground">隐藏</span>
						</div>
					)}
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
