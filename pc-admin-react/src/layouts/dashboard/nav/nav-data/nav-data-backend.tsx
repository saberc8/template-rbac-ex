import { Icon } from "@/components/icon";
import type { NavItemDataProps, NavProps } from "@/components/nav";
import { useBackendRoutes } from "@/store/routeStore";
import { useMemo } from "react";
import type { BackendRouteItem } from "#/backend";

const iconMap: Record<string, string> = {
	settings: "mdi:cog",
	user: "mdi:account",
	bookmark: "mdi:bookmark",
	history: "mdi:history",
	computer: "mdi:monitor",
	config: "mdi:cog-outline",
	apps: "mdi:apps",
	safe: "mdi:shield-lock",
	lock: "mdi:lock",
	storage: "mdi:database",
	mobile: "mdi:cellphone",
};

const mapBackendIcon = (icon: string) => iconMap[icon] || icon;

const convertChildren = (children?: BackendRouteItem[]): NavItemDataProps[] => {
	if (!children?.length) return [];

	return children.map((child) => ({
		title: child.title,
		path: child.path || "",
		icon: child.icon ? <Icon icon={mapBackendIcon(child.icon)} size="24" /> : null,
		caption: undefined,
		info: undefined,
		disabled: child.status === 0,
		auth: child.permission ? [child.permission] : undefined,
		hidden: child.isHidden,
		children: convertChildren(child.children),
	}));
};

export const convertBackendRoutesToNavData = (routeTree: BackendRouteItem[]): NavProps["data"] => {
	return [
		{
			items: routeTree.map((root) => ({
				title: root.title,
				path: root.path,
				icon: root.icon ? <Icon icon={mapBackendIcon(root.icon)} size="24" /> : null,
				disabled: root.status === 0,
				auth: root.permission ? [root.permission] : undefined,
				hidden: root.isHidden,
				children: convertChildren(root.children),
			})),
		},
	];
};

export const useBackendNavData = (): NavProps["data"] => {
	const routes = useBackendRoutes();
	return useMemo(() => convertBackendRoutesToNavData(routes), [routes]);
};
