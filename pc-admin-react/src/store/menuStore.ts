import menuService from "@/api/services/menuService";
import type { MenuTree } from "@/types/entity";
import { create } from "zustand";

type MenuStore = {
	backendMenuTree: MenuTree[];
	actions: {
		setBackendMenuTree: (tree: MenuTree[]) => void;
		initBackendMenuTree: () => Promise<MenuTree[]>;
		clearBackendMenuTree: () => void;
	};
};

export const useMenuStore = create<MenuStore>((set, get) => ({
	backendMenuTree: [],
	actions: {
		setBackendMenuTree: (tree) => set({ backendMenuTree: tree || [] }),
		clearBackendMenuTree: () => set({ backendMenuTree: [] }),
		initBackendMenuTree: async () => {
			const tree = await menuService.getMenuTree();
			set({ backendMenuTree: tree || [] });
			return get().backendMenuTree;
		},
	},
}));

export const getBackendMenuTreeSnapshot = () => useMenuStore.getState().backendMenuTree;

