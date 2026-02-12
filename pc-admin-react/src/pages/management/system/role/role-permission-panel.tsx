// 角色-功能权限：对接 /system/role/:id/permission（菜单树勾选保存）

import { systemMenuService, type SysMenuNode } from "@/api/services/systemMenuService";
import { systemRoleService } from "@/api/services/systemRoleService";
import { Button } from "@/ui/button";
import { Switch } from "@/ui/switch";
import { Checkbox, Tree } from "antd";
import type { Key } from "react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type MenuNodeWithButtons = SysMenuNode & {
	buttons?: SysMenuNode[];
	children?: MenuNodeWithButtons[];
};

const stripEmptyChildren = (nodes: SysMenuNode[]): SysMenuNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

const normalizeCheckedKeys = (checked: Key[] | { checked: Key[]; halfChecked: Key[] }): string[] => {
	const keys = Array.isArray(checked) ? checked : checked.checked;
	return (keys || []).map((k) => String(k)).filter((x) => x && x !== "0");
};

export default function RolePermissionPanel({
	roleId,
	canSave,
}: {
	roleId: number;
	canSave: boolean;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const { data: menuTree } = useQuery({
		queryKey: ["systemMenu.tree"],
		queryFn: () => systemMenuService.tree(),
	});

	const { data: roleDetail } = useQuery({
		queryKey: ["systemRole.get", roleId],
		queryFn: () => systemRoleService.get(roleId),
		enabled: roleId > 0,
	});

	const [menuCheckStrictly, setMenuCheckStrictly] = useState<boolean>(true);
	// 同时包含：菜单 id + 按钮 id（全部用 string，避免与 Tree 的 string key 不匹配）
	const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

	useEffect(() => {
		if (!roleDetail) return;
		setMenuCheckStrictly(Boolean(roleDetail.menuCheckStrictly));
		setCheckedKeys((roleDetail.menuIds || []).map((x) => String(x)).filter((x) => x && x !== "0"));
	}, [roleDetail]);

	const mutation = useMutation({
		mutationFn: (payload: { menuIds: Array<string | number>; menuCheckStrictly: boolean }) =>
			systemRoleService.updatePermission(roleId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.get", roleId] });
		},
	});

	const translateTitle = useMemo(() => {
		return (value: string) => {
			const raw = String(value || "");
			if (!raw) return raw;
			const translated = t(raw);
			return translated === raw ? raw : translated;
		};
	}, [t]);

	const menuTreeWithButtons = useMemo((): MenuNodeWithButtons[] => {
		const splitButtons = (nodes: SysMenuNode[]): MenuNodeWithButtons[] => {
			return (nodes || []).map((n) => {
				const rawChildren = n.children || [];
				const buttons = rawChildren.filter((c) => Number(c.type) === 3);
				const children = rawChildren.filter((c) => Number(c.type) !== 3);
				return {
					...n,
					title: translateTitle(n.title),
					buttons: buttons.length
						? buttons.map((b) => ({
								...b,
								title: translateTitle(b.title),
							}))
						: undefined,
					children: children.length ? splitButtons(children) : undefined,
				};
			});
		};
		return stripEmptyChildren(splitButtons(menuTree || []) as any) as any;
	}, [menuTree, translateTitle]);

	const { menuIdSet, menuToButtonIds } = useMemo(() => {
		const menuIdSet = new Set<string>();
		const menuToButtonIds = new Map<string, string[]>();
		const walk = (nodes: MenuNodeWithButtons[]) => {
			for (const n of nodes || []) {
				const menuId = String(n.id);
				menuIdSet.add(menuId);
				if (n.buttons?.length) {
					menuToButtonIds.set(
						menuId,
						n.buttons.map((b) => String(b.id)).filter((x) => x && x !== "0"),
					);
				}
				if (n.children?.length) walk(n.children);
			}
		};
		walk(menuTreeWithButtons || []);
		return { menuIdSet, menuToButtonIds };
	}, [menuTreeWithButtons]);

	// Tree 仅勾选菜单节点；按钮勾选由 checkbox group 承担
	const checkedMenuKeys = useMemo(() => checkedKeys.filter((k) => menuIdSet.has(String(k))), [checkedKeys, menuIdSet]);
	const checkedKeySet = useMemo(() => new Set(checkedKeys.map(String)), [checkedKeys]);

	const onCheck = (checked: any) => {
		const nextMenuKeys = normalizeCheckedKeys(checked);
		const next = new Set<string>(nextMenuKeys);

		if (menuCheckStrictly) {
			// 严格勾选：保留“仍然勾选的菜单”下已选按钮；菜单取消勾选则其按钮一并取消
			for (const mid of nextMenuKeys) {
				const btns = menuToButtonIds.get(String(mid)) || [];
				for (const bid of btns) {
					if (checkedKeySet.has(String(bid))) next.add(String(bid));
				}
			}
		} else {
			// 节点联动：勾选菜单时自动勾选其按钮
			for (const mid of nextMenuKeys) {
				const btns = menuToButtonIds.get(String(mid)) || [];
				for (const bid of btns) next.add(String(bid));
			}
		}

		setCheckedKeys(Array.from(next));
	};

	// 选择按钮时，确保其父菜单也被勾选（避免“只有按钮没有菜单”的悬空权限）
	const onButtonsChange = useCallback(
		(menuId: string, nextButtonIds: string[]) => {
			setCheckedKeys((prev) => {
				const prevSet = new Set(prev.map(String));
				const toRemove = menuToButtonIds.get(String(menuId)) || [];
				for (const bid of toRemove) prevSet.delete(String(bid));
				for (const bid of nextButtonIds || []) prevSet.add(String(bid));
				if ((nextButtonIds || []).length > 0) prevSet.add(String(menuId));

				// 联动模式下：按钮的勾选变化不自动影响同级/父子菜单，仅与菜单勾选联动（与 vue3 行为一致）
				return Array.from(prevSet);
			});
		},
		[menuToButtonIds],
	);

	// 兜底：若后端返回的 menuIds 里只有按钮 id（或历史脏数据），补齐父菜单勾选
	useEffect(() => {
		if (!menuTreeWithButtons?.length) return;
		setCheckedKeys((prev) => {
			const next = new Set(prev.map(String));
			for (const [mid, btns] of menuToButtonIds.entries()) {
				if (!btns?.length) continue;
				const anyBtnChecked = btns.some((bid) => next.has(String(bid)));
				if (anyBtnChecked) next.add(String(mid));
			}
			return Array.from(next);
		});
	}, [menuToButtonIds, menuTreeWithButtons]);

	const onSave = async () => {
		try {
			// React 菜单 id 可能超过 JS 安全整数范围，保存时保持 string，交由后端 int() 解析
			await mutation.mutateAsync({ menuIds: checkedKeys, menuCheckStrictly });
			toast.success("保存成功", { position: "top-center" });
		} catch {
			// handled by apiClient
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Switch checked={menuCheckStrictly} onCheckedChange={setMenuCheckStrictly} />
					<span className="text-sm text-muted-foreground">严格勾选（父子不联动）</span>
				</div>
				<Button disabled={!canSave || mutation.isPending} onClick={onSave}>
					保存
				</Button>
			</div>

			<div className="rounded-md border p-2">
				<Tree
					checkable
					blockNode
					checkStrictly={menuCheckStrictly}
					checkedKeys={menuCheckStrictly ? { checked: checkedMenuKeys, halfChecked: [] } : checkedMenuKeys}
					onCheck={onCheck}
					treeData={menuTreeWithButtons as any}
					fieldNames={{ key: "id", title: "title", children: "children" }}
					titleRender={(nodeData: any) => {
						const menuId = String(nodeData?.id ?? "");
						const buttons: SysMenuNode[] | undefined = nodeData?.buttons;
						if (!buttons?.length) return <span className="block truncate">{nodeData?.title}</span>;

						const checkedButtonIds = (buttons || [])
							.map((b) => String(b.id))
							.filter((id) => checkedKeySet.has(String(id)));

						return (
							<div className="flex flex-wrap items-center gap-2 min-w-0">
								<span className="block truncate">{nodeData?.title}</span>
								<div className="flex flex-wrap items-center gap-2">
									<Checkbox.Group
										disabled={!canSave || mutation.isPending}
										value={checkedButtonIds}
										onChange={(vals) => onButtonsChange(menuId, (vals as any[]).map((v) => String(v)))}
									>
										{buttons.map((b) => (
											<Checkbox
												key={String(b.id)}
												value={String(b.id)}
												onClick={(e) => e.stopPropagation()}
											>
												{String(b.title || "")}
											</Checkbox>
										))}
									</Checkbox.Group>
								</div>
							</div>
						);
					}}
				/>
			</div>
		</div>
	);
}
