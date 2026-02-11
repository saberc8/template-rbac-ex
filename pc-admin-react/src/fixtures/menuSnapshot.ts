import type { Menu } from "#/entity";
import { PermissionType } from "#/enum";

const { GROUP, MENU, CATALOGUE } = PermissionType;

export const MENU_SNAPSHOT: Menu[] = [
	// group
	{ id: "group_dashboard", name: "sys.nav.dashboard", code: "dashboard", parentId: "", type: GROUP },
	{ id: "group_pages", name: "sys.nav.pages", code: "pages", parentId: "", type: GROUP },

	// group_dashboard
	{
		id: "workbench",
		parentId: "group_dashboard",
		name: "sys.nav.workbench",
		code: "workbench",
		icon: "local:ic-workbench",
		type: MENU,
		path: "/workbench",
		component: "/pages/dashboard/workbench",
	},
	{
		id: "analysis",
		parentId: "group_dashboard",
		name: "sys.nav.analysis",
		code: "analysis",
		icon: "local:ic-analysis",
		type: MENU,
		path: "/analysis",
		component: "/pages/dashboard/analysis",
	},

	// group_pages
	// management
	{
		id: "management",
		parentId: "group_pages",
		name: "sys.nav.management",
		code: "management",
		icon: "local:ic-management",
		type: CATALOGUE,
		path: "/management",
	},
	{
		id: "management_system_user",
		parentId: "management",
		name: "sys.nav.system.user",
		code: "management:system:user",
		type: MENU,
		path: "/management/system/user",
		component: "/pages/management/system/user",
	},
	{
		id: "management_system_role",
		parentId: "management",
		name: "sys.nav.system.role",
		code: "management:system:role",
		type: MENU,
		path: "/management/system/role",
		component: "/pages/management/system/role",
	},
	{
		id: "management_system_permission",
		parentId: "management",
		name: "sys.nav.system.permission",
		code: "management:system:permission",
		type: MENU,
		path: "/management/system/permission",
		component: "/pages/management/system/permission",
	},
	{
		id: "management_system_organization",
		parentId: "management",
		name: "sys.nav.system.organization",
		code: "system:dept:list",
		type: MENU,
		path: "/management/system/organization",
		component: "/pages/management/system/organization",
	},
	{
		id: "management_system_file",
		parentId: "management",
		name: "sys.nav.system.file",
		code: "system:file:list",
		type: MENU,
		path: "/management/system/file",
		component: "/pages/management/system/file",
	},
	{
		id: "management_system_dict",
		parentId: "management",
		name: "sys.nav.system.dict",
		code: "system:dict:list",
		type: MENU,
		path: "/management/system/dict",
		component: "/pages/management/system/dict",
	},
	{
		id: "management_system_option",
		parentId: "management",
		name: "sys.nav.system.option",
		code: "system:siteConfig:get",
		type: MENU,
		path: "/management/system/option",
		component: "/pages/management/system/option",
	},
	// erros
	{ id: "error", parentId: "group_pages", name: "sys.nav.error.index", code: "error", icon: "bxs:error-alt", type: CATALOGUE, path: "/error" },
	{ id: "error_403", parentId: "error", name: "sys.nav.error.403", code: "error:403", type: MENU, path: "/error/403", component: "/pages/sys/error/Page403" },
	{ id: "error_404", parentId: "error", name: "sys.nav.error.404", code: "error:404", type: MENU, path: "/error/404", component: "/pages/sys/error/Page404" },
	{ id: "error_500", parentId: "error", name: "sys.nav.error.500", code: "error:500", type: MENU, path: "/error/500", component: "/pages/sys/error/Page500" },

];
