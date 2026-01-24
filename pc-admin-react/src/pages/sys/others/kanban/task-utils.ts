import { type DndDataType, type TaskComment, TaskPriority, TaskTag } from "./types";

const DEFAULT_AVATAR_URL = "https://avatars.githubusercontent.com/u/583231?v=4";

const comments: TaskComment[] = [
	{
		username: "系统",
		avatar: DEFAULT_AVATAR_URL,
		content: "这是一个示例评论（已移除 mock 数据生成）。",
		time: new Date(),
	},
];

export const initialData: DndDataType = {
	tasks: {
		"task-1": {
			id: "task-1",
			title: "完善用户列表页面",
			reporter: DEFAULT_AVATAR_URL,
			priority: TaskPriority.LOW,
			tags: [],
			comments: [],
			attachments: [],
		},
		"task-2": {
			id: "task-2",
			title: "对接角色接口并支持编辑",
			reporter: DEFAULT_AVATAR_URL,
			assignee: [DEFAULT_AVATAR_URL],
			date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
			priority: TaskPriority.HIGH,
			tags: [TaskTag.fullstack, TaskTag.UI],
			comments,
			attachments: [],
		},
		"task-3": {
			id: "task-3",
			title: "清理 mock 依赖与入口",
			reporter: DEFAULT_AVATAR_URL,
			assignee: [DEFAULT_AVATAR_URL],
			priority: TaskPriority.MEDIUM,
			date: new Date(Date.now() + 3 * 24 * 3600 * 1000),
			tags: [TaskTag.DevOps],
			comments,
			attachments: [],
		},
		"task-4": {
			id: "task-4",
			title: "实现菜单树展示与操作",
			reporter: DEFAULT_AVATAR_URL,
			assignee: [DEFAULT_AVATAR_URL, DEFAULT_AVATAR_URL],
			priority: TaskPriority.MEDIUM,
			tags: [TaskTag.backend],
			date: new Date(Date.now() + 10 * 24 * 3600 * 1000),
			description: "支持树形展示、基础新增/编辑/删除能力，并对齐后端接口。",
			attachments: [],
			comments,
		},
		"task-5": {
			id: "task-5",
			title: "在线用户监控页面",
			reporter: DEFAULT_AVATAR_URL,
			priority: TaskPriority.HIGH,
			assignee: [DEFAULT_AVATAR_URL],
			tags: [TaskTag.frontend, TaskTag.UI],
			date: new Date(Date.now() + 2 * 24 * 3600 * 1000),
			description: "展示在线用户列表并支持强退（调用后端接口）。",
			attachments: [],
			comments,
		},
		"task-6": {
			id: "task-6",
			title: "系统日志列表与详情",
			reporter: DEFAULT_AVATAR_URL,
			priority: TaskPriority.LOW,
			assignee: [DEFAULT_AVATAR_URL],
			tags: [TaskTag.QA, TaskTag.UI],
			date: new Date(Date.now() + 5 * 24 * 3600 * 1000),
			description: "展示系统日志列表，并提供查看详情能力。",
			attachments: [],
			comments,
		},
	},
	columns: {
		"column-1": {
			id: "column-1",
			title: "To do",
			taskIds: ["task-1", "task-2", "task-3"],
		},
		"column-2": {
			id: "column-2",
			title: "In progress",
			taskIds: ["task-4", "task-5"],
		},
		"column-3": {
			id: "column-3",
			title: "Done",
			taskIds: ["task-6"],
		},
	},
	columnOrder: ["column-1", "column-2", "column-3"],
};
