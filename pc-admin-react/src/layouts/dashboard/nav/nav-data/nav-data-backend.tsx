import { Icon } from "@/components/icon";
import type { NavItemDataProps, NavProps } from "@/components/nav";
import { MENU_SNAPSHOT } from "@/fixtures/menuSnapshot";
import type { MenuTree } from "@/types/entity";
import { Badge } from "@/ui/badge";
import { convertFlatToTree } from "@/utils/tree";

const isBlank = (v?: string | null) => !v || String(v).trim() === "";

const normalizeBackendRoots = (menuTree: MenuTree[]): MenuTree[] => {
	const out: MenuTree[] = [];
	for (const item of menuTree) {
		// 兼容旧结构：root 可能包含 GROUP(0) 容器（如 group_pages/group_dashboard），需要透明化。
		if (item.type === 0) {
			if (item.children?.length) out.push(...item.children);
			continue;
		}
		out.push(item);
	}
	return out;
};

const convertToNavItem = (node: MenuTree): NavItemDataProps | null => {
	const children = (node.children || []).map(convertToNavItem).filter((x): x is NavItemDataProps => x !== null);
	const path = String(node.path || "");

	// 过滤残留空节点（常见于老库未 force 删除的分组/目录残留）
	if (isBlank(path) && children.length === 0) return null;

	return {
		title: node.name,
		path,
		icon: node.icon ? (typeof node.icon === "string" ? <Icon icon={node.icon} size="24" /> : node.icon) : null,
		caption: node.caption,
		info: node.info ? <Badge variant="default">{node.info}</Badge> : null,
		disabled: node.disabled,
		auth: node.auth,
		hidden: node.hidden,
		children: children.length ? children : undefined,
	};
};

export const buildBackendNavData = (menuTree: MenuTree[]): NavProps["data"] => {
	const tree = menuTree && menuTree.length > 0 ? menuTree : convertFlatToTree(MENU_SNAPSHOT);
	const roots = normalizeBackendRoots(tree);
	const items = roots.map(convertToNavItem).filter((x): x is NavItemDataProps => x !== null);

	// React 侧边栏支持“无分组标题”的单组渲染；用于移除 Pages 分组后的导航结构。
	return [
		{
			name: undefined,
			items,
		},
	];
};
