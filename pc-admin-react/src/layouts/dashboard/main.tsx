import { AuthGuard } from "@/components/auth/auth-guard";
import { LineLoading } from "@/components/loading";
import { GLOBAL_CONFIG } from "@/global-config";
import Page403 from "@/pages/sys/error/Page403";
import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import { flattenTrees } from "@/utils/tree";
import { concat } from "ramda";
import { Suspense, useMemo } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useFilteredNavData } from "./nav";

/**
 * find auth by path
 * @param path
 * @returns
 */
function findAuthByPath(path: string, allItems: any[]): string[] {
	const foundItem = allItems.find((item) => item.path === path);
	return foundItem?.auth || [];
}

const Main = () => {
	const { themeStretch } = useSettings();

	const navData = useFilteredNavData();
	const allItems = useMemo(() => {
		return navData.reduce((acc: any[], group) => {
			const flattenedItems = flattenTrees(group.items);
			return concat(acc, flattenedItems);
		}, []);
	}, [navData]);

	const { pathname, search } = useLocation();
	const currentNavAuth = findAuthByPath(`${pathname}${search}`, allItems);

	const content = (
			<main
				data-slot="slash-layout-main"
				className={cn(
					"flex-auto w-full flex flex-col",
					"transition-[max-width] duration-300 ease-in-out",
					"px-4 sm:px-6 py-4 sm:py-6 md:px-8 mx-auto",
					{
						"max-w-full": themeStretch,
						"xl:max-w-screen-xl": !themeStretch,
					},
				)}
				style={{
					willChange: "max-width",
				}}
			>
				<Suspense fallback={<LineLoading />}>
					<Outlet />
					<ScrollRestoration />
				</Suspense>
			</main>
	);

	// 后端路由模式：路由数据已经由后端按角色过滤，避免重复拦截导致误判。
	if (GLOBAL_CONFIG.routerMode === "backend") {
		return content;
	}

	return (
		<AuthGuard checkAny={currentNavAuth} fallback={<Page403 />}>
			{content}
		</AuthGuard>
	);
};

export default Main;
