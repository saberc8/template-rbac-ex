import { setupWorker } from "msw/browser";
import { mockTokenExpired } from "./handlers/_demo";
import { menuList } from "./handlers/_menu";
import { userList } from "./handlers/_user";

const handlers = [userList, mockTokenExpired, menuList];
const worker = setupWorker(...handlers);

export { worker };
