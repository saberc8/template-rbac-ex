import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";

export const frontendNavData: NavProps["data"] = [
	{
		name: "sys.nav.dashboard",
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
		],
	},
	{
		name: "sys.nav.pages",
		items: [
			// management
			{
				title: "sys.nav.management",
				path: "/management",
				icon: <Icon icon="local:ic-management" size="24" />,
				children: [
					{
						title: "sys.nav.system.client",
						path: "/management/system/client",
					},
					{
						title: "sys.nav.system.organization",
						path: "/management/system/organization",
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
						title: "sys.nav.system.permission",
						path: "/management/system/permission",
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
						title: "sys.nav.monitor.index",
						path: "/management/monitor",
						children: [
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
				],
			},
			// errors
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
	{
		name: "sys.nav.ui",
		items: [
			// components
			{
				title: "sys.nav.components",
				path: "/components",
				icon: <Icon icon="solar:widget-5-bold-duotone" size="24" />,
				caption: "sys.nav.custom_ui_components",
				children: [
					{
						title: "sys.nav.icon",
						path: "/components/icon",
					},
					{
						title: "sys.nav.animate",
						path: "/components/animate",
					},
					{
						title: "sys.nav.scroll",
						path: "/components/scroll",
					},
					{
						title: "sys.nav.i18n",
						path: "/components/multi-language",
					},
					{
						title: "sys.nav.upload",
						path: "/components/upload",
					},
					{
						title: "sys.nav.chart",
						path: "/components/chart",
					},
					{
						title: "sys.nav.toast",
						path: "/components/toast",
					},
				],
			},
			// functions
			{
				title: "sys.nav.functions",
				path: "/functions",
				icon: <Icon icon="solar:plain-2-bold-duotone" size="24" />,
				children: [
					{
						title: "sys.nav.clipboard",
						path: "/functions/clipboard",
					},
					{
						title: "sys.nav.token_expired",
						path: "/functions/token_expired",
					},
				],
			},
		],
	},
];
