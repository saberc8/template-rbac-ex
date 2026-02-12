"""用户管理用例编排（system_user 写接口）。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.response import APIResponse, fail, ok
from app.security.password import hash_password
from app.security.password_policy import validate_password


def create_user(
    *,
    db: Session,
    operator_user_id: int,
    username: str,
    nickname: str,
    password: str,
    gender: int,
    status: int,
    dept_id: int,
    role_ids: list[int],
    email: str,
    phone: str,
    avatar: str,
    description: str,
) -> APIResponse:
    if username == "" or nickname == "":
        return fail("400", "用户名和昵称不能为空")
    if dept_id == 0:
        return fail("400", "所属部门不能为空")
    if status == 0:
        status = 1
    if password == "":
        return fail("400", "密码不能为空")

    raw_pwd, err = validate_password(password)
    if err is not None:
        return err

    try:
        encoded_pwd = hash_password(raw_pwd or "")
    except Exception:
        return fail("500", "密码加密失败")

    uid = next_id()
    if uid <= 0:
        return fail("500", "新增用户失败")

    now = datetime.now()
    try:
        db.add(
            SysUser(
                id=uid,
                username=username,
                nickname=nickname,
                password=encoded_pwd,
                gender=gender,
                email=email or None,
                phone=phone or None,
                avatar=avatar or None,
                description=description or None,
                status=status,
                is_system=False,
                pwd_reset_time=now,
                dept_id=dept_id,
                create_user=int(operator_user_id),
                create_time=now,
            )
        )
        for rid in role_ids:
            db.add(SysUserRole(id=next_id(), user_id=uid, role_id=rid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增用户失败")

    return ok({"id": uid})


def update_user(
    *,
    db: Session,
    operator_user_id: int,
    user_id: int,
    username: str,
    nickname: str,
    gender: int,
    status: int,
    dept_id: int,
    role_ids: list[int],
    email: str,
    phone: str,
    avatar: str,
    description: str,
) -> APIResponse:
    if user_id <= 0:
        return fail("400", "ID 参数不正确")
    if username == "" or nickname == "":
        return fail("400", "用户名和昵称不能为空")
    if dept_id == 0:
        return fail("400", "所属部门不能为空")
    if status == 0:
        status = 1

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(
                username=username,
                nickname=nickname,
                gender=gender,
                email=email or None,
                phone=phone or None,
                avatar=avatar or None,
                description=description or None,
                status=status,
                dept_id=dept_id,
                update_user=int(operator_user_id),
                update_time=now,
            )
        )
        db.execute(delete(SysUserRole).where(SysUserRole.user_id == int(user_id)))
        for rid in role_ids:
            db.add(SysUserRole(id=next_id(), user_id=int(user_id), role_id=rid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改用户失败")

    return ok(True)


def delete_users(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "ID 列表不能为空")

    try:
        from sqlalchemy import select as _select

        for uid in ids:
            row = db.execute(_select(SysUser.is_system).where(SysUser.id == uid).limit(1)).first()
            if row is None:
                continue
            if bool(row[0]):
                continue
            db.execute(delete(SysUserRole).where(SysUserRole.user_id == uid))
            db.execute(delete(SysUser).where(SysUser.id == uid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除用户失败")
    return ok(True)


def reset_password(
    *,
    db: Session,
    operator_user_id: int,
    user_id: int,
    new_password: str,
) -> APIResponse:
    if user_id <= 0:
        return fail("400", "ID 参数不正确")

    raw_pwd, err = validate_password(new_password)
    if err is not None:
        return err
    try:
        encoded = hash_password(raw_pwd or "")
    except Exception:
        return fail("500", "密码加密失败")

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(password=encoded, pwd_reset_time=now, update_user=int(operator_user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "重置密码失败")
    return ok(True)


def update_user_role(*, db: Session, user_id: int, role_ids: list[int]) -> APIResponse:
    if user_id <= 0:
        return fail("400", "ID 参数不正确")

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.user_id == int(user_id)))
        for rid in role_ids:
            db.add(SysUserRole(id=next_id(), user_id=int(user_id), role_id=rid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "分配角色失败")
    return ok(True)
