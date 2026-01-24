import apiClient from "../apiClient";

import type { BackendRouteItem } from "#/backend";

export enum MenuApi {
	UserRoute = "/auth/user/route",
}

const getUserRoute = () => apiClient.get<BackendRouteItem[]>({ url: MenuApi.UserRoute });

export default {
	getUserRoute,
};
