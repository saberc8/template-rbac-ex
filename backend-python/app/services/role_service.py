"""角色用例编排（role 写接口）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role import SysRole
from app.db.models.sys_role_dept import SysRoleDept
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user_role import SysUserRole
from app.http.response import APIResponse, fail, ok
from app.http.validators import parse_positive_int_list_allow_empty


def create_role(*, db: Session, user_id: int, body: dict[str, Any]) -> APIResponse:
    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip()
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    try:
        sort_val = int(body.get("sort") or 0)
    except Exception:
        sort_val = 0
    if sort_val <= 0:
        sort_val = 999

    try:
        data_scope = int(body.get("dataScope") or 0)
    except Exception:
        data_scope = 0
    if data_scope == 0:
        data_scope = 4

    dept_ids = parse_positive_int_list_allow_empty(body.get("deptIds"))
    dept_check_strict = bool(body.get("deptCheckStrictly") or False)

    rid = next_id()
    if rid <= 0:
        return fail("500", "新增角色失败")
    now = datetime.now()

    try:
        db.add(
            SysRole(
                id=rid,
                name=name,
                code=code,
                data_scope=data_scope,
                description=str(body.get("description") or "").strip() or None,
                sort=sort_val,
                is_system=False,
                menu_check_strictly=True,
                dept_check_strictly=dept_check_strict,
                create_user=int(user_id),
                create_time=now,
            )
        )
        for did in dept_ids:
            db.add(SysRoleDept(role_id=rid, dept_id=did))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增角色失败")

    return ok({"id": rid})


def update_role(*, db: Session, user_id: int, role_id: int, body: dict[str, Any]) -> APIResponse:
    if role_id <= 0:
        return fail("400", "ID 参数不正确")

    name = str(body.get("name") or "").strip()
    if name == "":
        return fail("400", "名称不能为空")

    try:
        sort_val = int(body.get("sort") or 0)
    except Exception:
        sort_val = 0
    if sort_val <= 0:
        sort_val = 999

    try:
        data_scope = int(body.get("dataScope") or 0)
    except Exception:
        data_scope = 0
    if data_scope == 0:
        data_scope = 4

    dept_ids = parse_positive_int_list_allow_empty(body.get("deptIds"))
    dept_check_strict = bool(body.get("deptCheckStrictly") or False)
    now = datetime.now()

    try:
        db.execute(
            update(SysRole)
            .where(SysRole.id == int(role_id))
            .values(
                name=name,
                description=str(body.get("description") or "").strip(),
                sort=sort_val,
                data_scope=data_scope,
                dept_check_strictly=dept_check_strict,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.execute(delete(SysRoleDept).where(SysRoleDept.role_id == int(role_id)))
        for did in dept_ids:
            db.add(SysRoleDept(role_id=int(role_id), dept_id=did))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改角色失败")

    return ok(True)


def delete_roles(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "ID 列表不能为空")

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.role_id.in_(ids)))
        db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id.in_(ids)))
        db.execute(delete(SysRoleDept).where(SysRoleDept.role_id.in_(ids)))
        db.execute(delete(SysRole).where(SysRole.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除角色失败")
    return ok(True)


def update_role_permission(
    *,
    db: Session,
    user_id: int,
    role_id: int,
    frontend: Optional[str],
    body: dict[str, Any],
) -> APIResponse:
    if role_id <= 0:
        return fail("400", "ID 参数不正确")

    menu_ids = parse_positive_int_list_allow_empty(body.get("menuIds"))
    menu_check_strict = bool(body.get("menuCheckStrictly") or False)
    now = datetime.now()

    if frontend is not None:
        # 仅允许保存当前前端数据集下的 menu_id，避免跨数据集误绑定/覆盖。
        allowed = (
            db.execute(select(SysMenu.id).where(SysMenu.id.in_(menu_ids)).where(SysMenu.frontend == frontend))
            .scalars()
            .all()
            if menu_ids
            else []
        )
        allowed_ids = [int(x) for x in allowed if int(x) > 0]
        menu_ids = list(dict.fromkeys(allowed_ids))

    try:
        if frontend is None:
            db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == int(role_id)))
        else:
            # 仅清理当前前端数据集下的 role-menu 关联，避免另一个前端权限被覆盖。
            db.execute(
                delete(SysRoleMenu)
                .where(SysRoleMenu.role_id == int(role_id))
                .where(SysRoleMenu.menu_id.in_(select(SysMenu.id).where(SysMenu.frontend == frontend)))
            )

        for mid in menu_ids:
            db.add(SysRoleMenu(role_id=int(role_id), menu_id=mid))
        db.execute(
            update(SysRole)
            .where(SysRole.id == int(role_id))
            .values(menu_check_strictly=menu_check_strict, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "保存角色菜单失败")

    return ok(True)


def assign_to_users(*, db: Session, role_id: int, body: list[Any]) -> APIResponse:
    if role_id <= 0:
        return fail("400", "ID 参数不正确")

    user_ids = parse_positive_int_list_allow_empty(body)
    if not user_ids:
        return ok(True)

    try:
        existing = db.execute(
            select(SysUserRole.user_id)
            .where(SysUserRole.role_id == int(role_id))
            .where(SysUserRole.user_id.in_(user_ids))
        ).all()
        existing_set = {int(r[0]) for r in existing}
        for uid in user_ids:
            if uid in existing_set:
                continue
            db.add(SysUserRole(id=next_id(), user_id=uid, role_id=int(role_id)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "分配用户失败")

    return ok(True)


def unassign_from_users(*, db: Session, body: list[Any]) -> APIResponse:
    ids = parse_positive_int_list_allow_empty(body)
    if not ids:
        return fail("400", "用户角色ID列表不能为空")

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "取消分配失败")
    return ok(True)
