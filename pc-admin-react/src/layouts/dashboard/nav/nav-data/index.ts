import type { NavItemDataProps } from "@/components/nav/types";
import type { NavProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useUserPermissions } from "@/store/userStore";
import { checkAny } from "@/utils";
import { useMemo } from "react";
import { frontendNavData } from "./nav-data-frontend";
import { useBackendNavData } from "./nav-data-backend";

/**
 * 递归处理导航数据，过滤掉没有权限的项目
 * @param items 导航项目数组
 * @param permissions 权限列表
 * @returns 过滤后的导航项目数组
 */
const filterItems = (items: NavItemDataProps[], permissions: string[]) => {
	return items.filter((item) => {
		// 检查当前项目是否有权限
		const hasPermission = item.auth ? checkAny(item.auth, permissions) : true;

		// 如果有子项目，递归处理
		if (item.children?.length) {
			const filteredChildren = filterItems(item.children, permissions);
			// 如果子项目都被过滤掉了，则过滤掉当前项目
			if (filteredChildren.length === 0) {
				return false;
			}
			// 更新子项目
			item.children = filteredChildren;
		}

		return hasPermission;
	});
};

/**
 * 根据权限过滤导航数据
 * @param source 导航数据
 * @param permissions 权限列表
 */
const filterNavData = (source: NavProps["data"], permissions: string[]): NavProps["data"] => {
	return source
		.map((group) => {
			const filteredItems = filterItems(group.items, permissions);
			if (filteredItems.length === 0) {
				return null;
			}
			return {
				...group,
				items: filteredItems,
			};
		})
		.filter((group): group is NonNullable<typeof group> => group !== null);
};

/**
 * Hook to get filtered navigation data based on user permissions
 * @returns Filtered navigation data
 */
export const useFilteredNavData = () => {
	const permissions = useUserPermissions();
	const backendNavData = useBackendNavData();
	const source = GLOBAL_CONFIG.routerMode === "backend" ? backendNavData : frontendNavData;
	return useMemo(() => filterNavData(source, permissions), [source, permissions]);
};
