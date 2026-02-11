import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";

export const frontendNavData: NavProps["data"] = [
	{
		name: undefined,
		items: [
			{
				title: "sys.nav.workbench",
				path: "/workbench",
				icon: <Icon icon="local:ic-workbench" size="24" />,
			},
			{
				title: "sys.nav.analysis",
				path: "/analysis",
				icon: <Icon icon="local:ic-analysis" size="24" />,
			},
			{
				title: "sys.nav.management",
				path: "/management",
				icon: <Icon icon="local:ic-management" size="24" />,
				children: [
					{
						title: "sys.nav.user.profile",
						path: "/management/user/profile",
					},
					{
						title: "sys.nav.system.client",
						path: "/management/system/client",
					},
					{
						title: "sys.nav.system.dept",
						path: "/management/system/dept",
					},
					{
						title: "sys.nav.system.option",
						path: "/management/system/option",
					},
					{
						title: "sys.nav.system.file",
						path: "/management/system/file",
					},
					{
						title: "sys.nav.system.menu",
						path: "/management/system/menu",
					},
					{
						title: "sys.nav.system.role",
						path: "/management/system/role",
					},
					{
						title: "sys.nav.system.storage",
						path: "/management/system/storage",
					},
					{
						title: "sys.nav.system.user",
						path: "/management/system/user",
					},
					{
						title: "sys.nav.system.dict",
						path: "/management/system/dict",
					},
					{
						title: "sys.nav.monitor.online",
						path: "/management/monitor/online",
					},
					{
						title: "sys.nav.monitor.log",
						path: "/management/monitor/log",
					},
				],
			},
			{
				title: "sys.nav.error.index",
				path: "/error",
				icon: <Icon icon="bxs:error-alt" size="24" />,
				children: [
					{
						title: "sys.nav.error.403",
						path: "/error/403",
					},
					{
						title: "sys.nav.error.404",
						path: "/error/404",
					},
					{
						title: "sys.nav.error.500",
						path: "/error/500",
					},
				],
			},
		],
	},
];
