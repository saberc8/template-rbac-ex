import type { EventInput } from "@fullcalendar/core";
import dayjs from "dayjs";

const createId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const INITIAL_EVENTS: EventInput[] = [
	{
		id: createId(),
		title: "项目启动会",
		start: dayjs().toISOString(),
		end: dayjs().add(10, "hour").toISOString(),
		color: "#7a0916",
	},
	{
		id: createId(),
		title: "需求评审",
		start: dayjs().add(1, "day").toISOString(),
		end: dayjs().add(3, "day").toISOString(),
		allDay: false,
		color: "#00b8d9",
	},
	{
		id: createId(),
		title: "开发冲刺",
		start: dayjs().add(3, "day").toISOString(),
		end: dayjs().add(5, "day").toISOString(),
		allDay: true,
		color: "#ff5630",
	},
	{
		id: createId(),
		title: "联调验收",
		start: dayjs().add(7, "day").toISOString(),
		end: dayjs().add(8, "day").toISOString(),
		allDay: false,
		color: "#ffab00",
	},
	{
		id: createId(),
		title: "发布准备",
		start: dayjs().add(8, "day").toISOString(),
		end: dayjs().add(9, "day").toISOString(),
		allDay: false,
		color: "#8e33ff",
	},
	{
		id: createId(),
		title: "复盘会议",
		start: dayjs().add(10, "day").toISOString(),
		end: dayjs().add(11, "day").toISOString(),
		color: "#00a76f",
	},
];
