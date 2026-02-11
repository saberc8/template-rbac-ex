// 角色-功能权限：对接 /system/role/:id/permission（菜单树勾选保存）

import { systemMenuService, type SysMenuNode } from "@/api/services/systemMenuService";
import { systemRoleService } from "@/api/services/systemRoleService";
import { Button } from "@/ui/button";
import { Switch } from "@/ui/switch";
import { Tree } from "antd";
import type { Key } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const stripEmptyChildren = (nodes: SysMenuNode[]): SysMenuNode[] => {
	return (nodes || []).map((node) => {
		const children = node.children && node.children.length > 0 ? stripEmptyChildren(node.children) : undefined;
		return {
			...node,
			children: children && children.length > 0 ? children : undefined,
		};
	});
};

const normalizeCheckedKeys = (checked: Key[] | { checked: Key[]; halfChecked: Key[] }): number[] => {
	const keys = Array.isArray(checked) ? checked : checked.checked;
	return (keys || []).map((k) => Number(k)).filter((x) => Number.isFinite(x) && x > 0);
};

export default function RolePermissionPanel({
	roleId,
	canSave,
}: {
	roleId: number;
	canSave: boolean;
}) {
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
	const [checkedKeys, setCheckedKeys] = useState<number[]>([]);

	useEffect(() => {
		if (!roleDetail) return;
		setMenuCheckStrictly(Boolean(roleDetail.menuCheckStrictly));
		setCheckedKeys((roleDetail.menuIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0));
	}, [roleDetail]);

	const mutation = useMutation({
		mutationFn: (payload: { menuIds: number[]; menuCheckStrictly: boolean }) => systemRoleService.updatePermission(roleId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["systemRole.get", roleId] });
		},
	});

	const treeData = useMemo(() => stripEmptyChildren(menuTree || []), [menuTree]);

	const onCheck = (checked: any) => {
		setCheckedKeys(normalizeCheckedKeys(checked));
	};

	const onSave = async () => {
		try {
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
					checkedKeys={menuCheckStrictly ? { checked: checkedKeys, halfChecked: [] } : checkedKeys}
					onCheck={onCheck}
					treeData={treeData as any}
					fieldNames={{ key: "id", title: "title", children: "children" }}
				/>
			</div>
		</div>
	);
}
