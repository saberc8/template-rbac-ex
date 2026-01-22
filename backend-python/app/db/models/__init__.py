"""数据库 ORM 模型集合（sys_*）。"""

from __future__ import annotations

# 确保 Base.metadata 包含所有表定义
from app.db.models.sys_client import SysClient  # noqa: F401
from app.db.models.sys_dept import SysDept  # noqa: F401
from app.db.models.sys_dict import SysDict  # noqa: F401
from app.db.models.sys_dict_item import SysDictItem  # noqa: F401
from app.db.models.sys_file import SysFile  # noqa: F401
from app.db.models.sys_log import SysLog  # noqa: F401
from app.db.models.sys_menu import SysMenu  # noqa: F401
from app.db.models.sys_option import SysOption  # noqa: F401
from app.db.models.sys_role import SysRole  # noqa: F401
from app.db.models.sys_role_dept import SysRoleDept  # noqa: F401
from app.db.models.sys_role_menu import SysRoleMenu  # noqa: F401
from app.db.models.sys_storage import SysStorage  # noqa: F401
from app.db.models.sys_user import SysUser  # noqa: F401
from app.db.models.sys_user_role import SysUserRole  # noqa: F401

