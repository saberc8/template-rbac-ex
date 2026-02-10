import type { NavItemDataProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useMenuStore } from "@/store/menuStore";
import { useUserPermissions } from "@/store/userStore";
import { checkAny } from "@/utils";
import { useMemo } from "react";
import { buildBackendNavData } from "./nav-data-backend";
import { frontendNavData } from "./nav-data-frontend";

/**
 * 递归处理导航数据，过滤掉没有权限的项目
 * @param items 导航项目数组
 * @param permissions 权限列表
 * @returns 过滤后的导航项目数组
 */
const filterItems = (items: NavItemDataProps[], permissions: string[]): NavItemDataProps[] => {
	const out: NavItemDataProps[] = [];
	for (const item of items) {
		const children = item.children?.length ? filterItems(item.children, permissions) : undefined;
		const hasPermission = item.auth ? checkAny(item.auth, permissions) : true;

		// 没权限且子项也都被过滤掉，则丢弃
		if (!hasPermission && (!children || children.length === 0)) continue;

		out.push({
			...item,
			children,
		});
	}
	return out;
};

/**
 *
 * 根据权限过滤导航数据
 * @param permissions 权限列表
 * @returns 过滤后的导航数据
 */
const filterNavData = (permissions: string[]) => {
	const menuTree = useMenuStore.getState().backendMenuTree;
	const rawNavData = GLOBAL_CONFIG.routerMode === "backend" ? buildBackendNavData(menuTree) : frontendNavData;

	return rawNavData
		.map((group) => {
			// 过滤组内的项目
			const filteredItems = filterItems(group.items, permissions);

			// 如果组内没有项目了，返回 null
			if (filteredItems.length === 0) {
				return null;
			}

			// 返回过滤后的组
			return {
				...group,
				items: filteredItems,
			};
		})
		.filter((group): group is NonNullable<typeof group> => group !== null); // 过滤掉空组
};

/**
 * Hook to get filtered navigation data based on user permissions
 * @returns Filtered navigation data
 */
export const useFilteredNavData = () => {
	const permissions = useUserPermissions();
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const filteredNavData = useMemo(() => filterNavData(permissionCodes), [permissionCodes]);
	return filteredNavData;
};
