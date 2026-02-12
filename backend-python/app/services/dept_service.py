"""部门用例编排（dept 写接口）。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_dept import SysDept
from app.db.models.sys_user import SysUser
from app.http.response import APIResponse, fail, ok


def create_dept(
    *,
    db: Session,
    user_id: int,
    name: str,
    parent_id: int,
    sort_val: int,
    status: int,
    description: str,
) -> APIResponse:
    name = str(name or "").strip()
    description = str(description or "").strip()

    if name == "":
        return fail("400", "名称不能为空")
    if parent_id == 0:
        return fail("400", "上级部门不能为空")
    if sort_val <= 0:
        sort_val = 1
    if status == 0:
        status = 1

    exists = db.execute(
        select(SysDept.id).where(SysDept.parent_id == parent_id).where(SysDept.name == name).limit(1)
    ).first()
    if exists is not None:
        return fail("400", "新增失败，该名称在当前上级下已存在")

    parent_ok = db.execute(select(SysDept.id).where(SysDept.id == parent_id).limit(1)).first()
    if parent_ok is None:
        return fail("400", "上级部门不存在")

    did = next_id()
    if did <= 0:
        return fail("500", "生成部门 ID 失败")
    now = datetime.now()

    try:
        db.add(
            SysDept(
                id=did,
                name=name,
                parent_id=parent_id,
                sort=sort_val,
                status=status,
                is_system=False,
                description=description or None,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增部门失败")

    return ok(True)


def update_dept(
    *,
    db: Session,
    user_id: int,
    dept_id: int,
    name: str,
    parent_id: int,
    sort_val: int,
    status: int,
    description: str,
) -> APIResponse:
    if dept_id <= 0:
        return fail("400", "无效的部门 ID")

    name = str(name or "").strip()
    description = str(description or "").strip()

    if name == "":
        return fail("400", "名称不能为空")
    if parent_id == 0:
        return fail("400", "上级部门不能为空")
    if sort_val <= 0:
        sort_val = 1
    if status == 0:
        status = 1

    meta = db.execute(
        select(SysDept.name, SysDept.parent_id, SysDept.is_system).where(SysDept.id == int(dept_id))
    ).first()
    if meta is None:
        return fail("404", "部门不存在")
    old_name = str(meta[0] or "")
    old_parent = int(meta[1] or 0)
    is_system = bool(meta[2])

    if is_system:
        if status == 2:
            return fail("400", f"[{old_name}] 是系统内置部门，不允许禁用")
        if parent_id != old_parent:
            return fail("400", f"[{old_name}] 是系统内置部门，不允许变更上级部门")

    exists = db.execute(
        select(SysDept.id)
        .where(SysDept.parent_id == parent_id)
        .where(SysDept.name == name)
        .where(SysDept.id != int(dept_id))
        .limit(1)
    ).first()
    if exists is not None:
        return fail("400", "修改失败，该名称在当前上级下已存在")

    parent_ok = db.execute(select(SysDept.id).where(SysDept.id == parent_id).limit(1)).first()
    if parent_ok is None:
        return fail("400", "上级部门不存在")

    now = datetime.now()
    try:
        db.execute(
            update(SysDept)
            .where(SysDept.id == int(dept_id))
            .values(
                name=name,
                parent_id=parent_id,
                sort=sort_val,
                status=status,
                description=description,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改部门失败")

    return ok(True)


def delete_depts(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "参数错误")

    sys_row = db.execute(
        select(SysDept.name).where(SysDept.id.in_(ids)).where(SysDept.is_system.is_(True)).limit(1)
    ).first()
    if sys_row is not None:
        return fail("400", f"所选部门 [{sys_row[0]}] 是系统内置部门，不允许删除")

    child_row = db.execute(select(SysDept.id).where(SysDept.parent_id.in_(ids)).limit(1)).first()
    if child_row is not None:
        return fail("400", "所选部门存在下级部门，不允许删除")

    user_row = db.execute(select(SysUser.id).where(SysUser.dept_id.in_(ids)).limit(1)).first()
    if user_row is not None:
        return fail("400", "所选部门存在用户关联，请解除关联后重试")

    try:
        db.execute(delete(SysDept).where(SysDept.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除部门失败")
    return ok(True)
