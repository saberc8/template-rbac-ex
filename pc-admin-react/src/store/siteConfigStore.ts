import { create } from "zustand";

import { siteOptionService } from "@/api/services/siteOptionService";
import { GLOBAL_CONFIG } from "@/global-config";

type SiteConfigStore = {
	loaded: boolean;
	SITE_TITLE: string;
	SITE_DESCRIPTION: string;
	SITE_COPYRIGHT: string;
	SITE_BEIAN: string;
	SITE_FAVICON: string;
	SITE_LOGO: string;

	actions: {
		initSiteConfig: () => Promise<void>;
		applyToDocument: () => void;
	};
};

const setFavicon = (href: string) => {
	if (typeof document === "undefined") return;
	const url = href?.trim() || "/favicon.ico";

	// 尽量复用现有节点，避免重复插入。
	const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
	let link = document.querySelector<HTMLLinkElement>(selectors.join(","));
	if (!link) {
		link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
	}
	link.href = url;
};

export const useSiteConfigStore = create<SiteConfigStore>((set, get) => ({
	loaded: false,
	SITE_TITLE: "",
	SITE_DESCRIPTION: "",
	SITE_COPYRIGHT: "",
	SITE_BEIAN: "",
	SITE_FAVICON: "",
	SITE_LOGO: "",

	actions: {
		initSiteConfig: async () => {
			if (get().loaded) return;
			try {
				const list = await siteOptionService.listSiteOptions();
				const next: Partial<SiteConfigStore> = {};
				for (const item of list || []) {
					const label = String(item?.label || "").trim();
					if (!label) continue;
					(next as any)[label] = String(item?.value || "");
				}
				set({ ...next, loaded: true } as any);
				get().actions.applyToDocument();
			} catch {
				// 开放接口失败时允许回退到静态配置
				set({ loaded: true });
				get().actions.applyToDocument();
			}
		},
		applyToDocument: () => {
			if (typeof document === "undefined") return;
			const s = get();
			const title = (s.SITE_TITLE || "").trim() || GLOBAL_CONFIG.appName;
			document.title = title;
			if (s.SITE_FAVICON) setFavicon(s.SITE_FAVICON);
		},
	},
}));

export const useSiteTitle = () => useSiteConfigStore((s) => (s.SITE_TITLE || "").trim() || GLOBAL_CONFIG.appName);
export const useSiteFavicon = () => useSiteConfigStore((s) => (s.SITE_FAVICON || "").trim());

