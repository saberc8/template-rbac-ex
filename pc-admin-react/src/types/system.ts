// Go 后端 system/monitor 模块接口类型定义：参考 backend-go 的 HTTP 响应结构与字段命名。

export type PageResult<T> = {
	list: T[];
	total: number;
};

export type IdsRequest = {
	ids: number[];
};

export type OptionResp = {
	id: number;
	name: string;
	code: string;
	value: any;
	description: string;
};

export type OptionUpdateReq = { id: number; code: string; value: any };
export type OptionResetReq = { code?: string[]; category?: string };

export type SystemUserResp = {
	id: number;
	username: string;
	nickname: string;
	avatar: string;
	gender: number;
	email: string;
	phone: string;
	description: string;
	status: number;
	isSystem: boolean;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	deptId: number;
	deptName: string;
	roleIds: number[];
	roleNames: string[];
	disabled: boolean;
	pwdResetTime?: string;
};

export type SystemUserPageQuery = {
	page: number;
	size: number;
	description?: string;
	status?: number;
	deptId?: number;
	createTime?: string[];
	sort?: string[];
};

export type SystemUserCreateReq = {
	username: string;
	nickname: string;
	password: string;
	gender: number;
	email: string;
	phone: string;
	avatar: string;
	description: string;
	status: number;
	deptId: number;
	roleIds: number[];
};

export type SystemUserUpdateReq = Omit<SystemUserCreateReq, "password">;

export type UserPasswordResetReq = { newPassword: string };
export type UserRoleUpdateReq = { roleIds: number[] };

export type UserImportParseResp = {
	importKey: string;
	totalRows: number;
	validRows: number;
	duplicateUserRows: number;
	duplicateEmailRows: number;
	duplicatePhoneRows: number;
};

export type UserImportResultResp = {
	totalRows: number;
	insertRows: number;
	updateRows: number;
};

export type RoleResp = {
	id: number;
	name: string;
	code: string;
	sort: number;
	description: string;
	dataScope: number;
	isSystem: boolean;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	disabled: boolean;
};

export type RoleQuery = {
	description?: string;
};

export type RoleDetailResp = RoleResp & {
	menuIds: number[];
	deptIds: number[];
	menuCheckStrictly: boolean;
	deptCheckStrictly: boolean;
};

export type RoleSaveReq = {
	name: string;
	code: string;
	sort: number;
	description: string;
	dataScope: number;
	deptIds: number[];
	deptCheckStrictly: boolean;
};

export type RolePermissionUpdateReq = { menuIds: number[]; menuCheckStrictly: boolean };

export type RoleUserResp = {
	id: number;
	roleId: number;
	userId: number;
	username: string;
	nickname: string;
	gender: number;
	status: number;
	isSystem: boolean;
	description: string;
	deptId: number;
	deptName: string;
	roleIds: number[];
	roleNames: string[];
	disabled: boolean;
};

export type RoleUserPageQuery = { page: number; size: number; description?: string; sort?: string[] };

export type MenuResp = {
	id: number;
	title: string;
	parentId: number;
	type: number;
	path: string;
	name: string;
	component: string;
	redirect: string;
	icon: string;
	isExternal: boolean;
	isCache: boolean;
	isHidden: boolean;
	permission: string;
	sort: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	children: MenuResp[];
};

export type MenuSaveReq = {
	type: number;
	icon: string;
	title: string;
	sort: number;
	permission: string;
	path: string;
	name: string;
	component: string;
	redirect: string;
	isExternal?: boolean;
	isCache?: boolean;
	isHidden?: boolean;
	parentId: number;
	status: number;
};

export type DeptResp = {
	id: number;
	name: string;
	sort: number;
	status: number;
	isSystem: boolean;
	description: string;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	parentId: number;
	children: DeptResp[];
};

export type DeptSaveReq = {
	name: string;
	parentId: number;
	sort: number;
	status: number;
	description: string;
};

export type DictResp = {
	id: number;
	name: string;
	code: string;
	isSystem: boolean;
	description: string;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type DictSaveReq = {
	name: string;
	code: string;
	description: string;
};

export type DictItemResp = {
	id: number;
	label: string;
	value: string;
	color: string;
	sort: number;
	description: string;
	status: number;
	dictId: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type DictItemPageQuery = {
	page: number;
	size: number;
	description?: string;
	status?: number;
	sort?: string[];
	dictId?: number;
};

export type DictItemSaveReq = {
	label: string;
	value: string;
	color: string;
	sort: number;
	description: string;
	status: number;
	dictId: number;
};

export type FileItem = {
	id: number;
	name: string;
	originalName: string;
	size?: number | null;
	url: string;
	parentPath: string;
	path: string;
	sha256: string;
	contentType: string;
	metadata: string;
	thumbnailSize?: number | null;
	thumbnailName: string;
	thumbnailMetadata: string;
	thumbnailUrl: string;
	extension: string;
	type: number;
	storageId: number;
	storageName: string;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
};

export type FilePageQuery = {
	page: number;
	size: number;
	originalName?: string;
	type?: number;
	parentPath?: string;
	sort?: string[];
};

export type FileStatisticsResp = {
	type: number;
	size: number;
	number: number;
	unit?: string;
	data?: FileStatisticsResp[];
};

export type FileDirCalcSizeResp = { size: number };

export type FileUploadResp = { id: string; url: string; thUrl: string; metadata: Record<string, string> };

export type FileDirCreateReq = { parentPath: string; name: string };

export type FileUpdateReq = { name?: string; description?: string };

export type OnlineUserResp = {
	id: number;
	token: string;
	username: string;
	nickname: string;
	clientType: string;
	clientId: string;
	ip: string;
	address: string;
	browser: string;
	os: string;
	loginTime: string;
	lastActiveTime: string;
};

export type OnlineUserPageQuery = {
	page: number;
	size: number;
	nickname?: string;
	loginTime?: string[];
};

export type LogResp = {
	id: number;
	description: string;
	module: string;
	timeTaken: number;
	ip: string;
	address: string;
	browser: string;
	os: string;
	status: number;
	errorMsg: string;
	createUserString: string;
	createTime: string;
};

export type LogDetailResp = {
	id: number;
	traceId: string;
	description: string;
	module: string;
	requestUrl: string;
	requestMethod: string;
	requestHeaders: string;
	requestBody: string;
	statusCode: number;
	responseHeaders: string;
	responseBody: string;
	timeTaken: number;
	ip: string;
	address: string;
	browser: string;
	os: string;
	status: number;
	errorMsg: string;
	createUserString: string;
	createTime: string;
};

export type LogPageQuery = {
	page: number;
	size: number;
	description?: string;
	module?: string;
	ip?: string;
	createUserString?: string;
	status?: number;
	createTime?: string[];
	sort?: string[];
};

export type ClientResp = {
	id: number;
	clientId: string;
	clientType: string;
	authType: string[];
	activeTimeout: number;
	timeout: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	disabled?: boolean;
};

export type ClientQuery = {
	page: number;
	size: number;
	clientType?: string;
	authType?: string[];
	status?: number;
	sort?: string[];
};

export type ClientSaveReq = {
	clientType: string;
	authType: string[];
	activeTimeout: number;
	timeout: number;
	status: number;
};

export type StorageResp = {
	id: number;
	name: string;
	code: string;
	type: number;
	accessKey: string;
	secretKey: string;
	endpoint: string;
	region: string;
	bucketName: string;
	domain: string;
	description: string;
	isDefault: boolean;
	sort: number;
	status: number;
	createUserString: string;
	createTime: string;
	updateUserString: string;
	updateTime: string;
	disabled?: boolean;
};

export type StorageQuery = {
	description?: string;
	type?: number;
	sort?: string[];
};

export type StorageSaveReq = {
	name: string;
	code: string;
	type: number;
	accessKey: string;
	secretKey?: string;
	endpoint: string;
	region: string;
	bucketName: string;
	domain: string;
	description: string;
	isDefault: boolean;
	sort: number;
	status: number;
};
