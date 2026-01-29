"""用户管理接口：/system/user/*（对齐 backend-go/internal/interfaces/http/system_user_handler.go）。"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_dept import SysDept
from app.db.models.sys_role import SysRole
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time
from app.security.password import hash_password

router = APIRouter()


def _validate_password(raw_pwd: str) -> tuple[Optional[str], Optional[tuple[str, str]]]:
    raw_pwd = (raw_pwd or "").strip()
    if raw_pwd == "":
        return None, ("400", "密码不能为空")
    if len(raw_pwd) < 8 or len(raw_pwd) > 32:
        return None, ("400", "密码长度为 8-32 个字符，至少包含字母和数字")
    has_letter = any(("a" <= ch <= "z") or ("A" <= ch <= "Z") for ch in raw_pwd)
    has_digit = any("0" <= ch <= "9" for ch in raw_pwd)
    if not has_letter or not has_digit:
        return None, ("400", "密码长度为 8-32 个字符，至少包含字母和数字")
    return raw_pwd, None


def _role_map_for_users(db: Session, user_ids: list[int]) -> dict[int, tuple[list[int], list[str]]]:
    if not user_ids:
        return {}
    rows = db.execute(
        select(SysUserRole.user_id, SysUserRole.role_id, SysRole.name)
        .select_from(SysUserRole)
        .join(SysRole, SysRole.id == SysUserRole.role_id)
        .where(SysUserRole.user_id.in_(user_ids))
    ).all()
    out: dict[int, tuple[list[int], list[str]]] = {}
    for uid, rid, rname in rows:
        uid_i = int(uid)
        if uid_i not in out:
            out[uid_i] = ([], [])
        out[uid_i][0].append(int(rid))
        out[uid_i][1].append(str(rname or ""))
    return out


def _to_user_resp(row: dict, role_ids: list[int], role_names: list[str]) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    is_system = bool(row.get("is_system") or False)
    return {
        "id": int(row.get("id") or 0),
        "username": str(row.get("username") or ""),
        "nickname": str(row.get("nickname") or ""),
        "avatar": str(row.get("avatar") or ""),
        "gender": int(row.get("gender") or 0),
        "email": str(row.get("email") or ""),
        "phone": str(row.get("phone") or ""),
        "description": str(row.get("description") or ""),
        "status": int(row.get("status") or 0),
        "isSystem": is_system,
        "createUserString": str(row.get("create_user_string") or ""),
        "createTime": format_time(ct) if isinstance(ct, datetime) else "",
        "updateUserString": str(row.get("update_user_string") or ""),
        "updateTime": format_time(ut) if isinstance(ut, datetime) else "",
        "deptId": int(row.get("dept_id") or 0),
        "deptName": str(row.get("dept_name") or ""),
        "roleIds": role_ids,
        "roleNames": role_names,
        "disabled": is_system,
    }


def _query_user_page(db: Session, q: dict) -> tuple[list[dict], int]:
    page = int(q.get("page") or 1)
    size = int(q.get("size") or 10)
    if page <= 0:
        page = 1
    if size <= 0:
        size = 10

    desc = (q.get("description") or "").strip()
    status_filter = q.get("status")
    dept_id = q.get("dept_id")

    dept = aliased(SysDept)
    cu = aliased(SysUser)
    uu = aliased(SysUser)

    stmt = (
        select(
            SysUser.id,
            SysUser.username,
            SysUser.nickname,
            SysUser.gender,
            SysUser.email,
            SysUser.phone,
            SysUser.avatar,
            SysUser.description,
            SysUser.status,
            SysUser.is_system,
            SysUser.dept_id,
            func.coalesce(dept.name, ""),
            SysUser.create_time,
            func.coalesce(cu.nickname, ""),
            SysUser.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysUser)
        .join(dept, dept.id == SysUser.dept_id, isouter=True)
        .join(cu, cu.id == SysUser.create_user, isouter=True)
        .join(uu, uu.id == SysUser.update_user, isouter=True)
    )

    if desc:
        like = f"%{desc}%"
        stmt = stmt.where(
            func.lower(SysUser.username).like(func.lower(like))
            | func.lower(SysUser.nickname).like(func.lower(like))
            | func.lower(func.coalesce(SysUser.description, "")).like(func.lower(like))
        )
    if status_filter is not None and int(status_filter) != 0:
        stmt = stmt.where(SysUser.status == int(status_filter))
    if dept_id is not None and int(dept_id) != 0:
        stmt = stmt.where(SysUser.dept_id == int(dept_id))

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    total = int(total or 0)
    if total == 0:
        return [], 0

    rows = db.execute(stmt.order_by(SysUser.id.desc()).limit(size).offset((page - 1) * size)).all()
    out: list[dict] = []
    for r in rows:
        out.append(
            {
                "id": r[0],
                "username": r[1],
                "nickname": r[2],
                "gender": r[3],
                "email": r[4],
                "phone": r[5],
                "avatar": r[6],
                "description": r[7],
                "status": r[8],
                "is_system": r[9],
                "dept_id": r[10],
                "dept_name": r[11],
                "create_time": r[12],
                "create_user_string": r[13],
                "update_time": r[14],
                "update_user_string": r[15],
            }
        )
    return out, total


@router.get("/system/user")
def list_user_page(request: Request, db: Session = Depends(get_db)):
    try:
        page = int(request.query_params.get("page") or "1")
    except Exception:
        page = 1
    try:
        size = int(request.query_params.get("size") or "10")
    except Exception:
        size = 10
    if page <= 0:
        page = 1
    if size <= 0:
        size = 10

    desc = (request.query_params.get("description") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()
    dept_str = (request.query_params.get("deptId") or "").strip()

    status_filter = None
    dept_id = None
    if status_str:
        try:
            status_filter = int(status_str)
        except Exception:
            status_filter = None
    if dept_str:
        try:
            dept_id = int(dept_str)
        except Exception:
            dept_id = None

    rows, total = _query_user_page(
        db,
        {
            "page": page,
            "size": size,
            "description": desc,
            "status": status_filter,
            "dept_id": dept_id,
        },
    )
    if total == 0:
        return ok({"list": [], "total": 0})

    user_ids = [int(r["id"]) for r in rows if int(r["id"] or 0) > 0]
    role_map = _role_map_for_users(db, user_ids)

    out = []
    for r in rows:
        rid, rname = role_map.get(int(r["id"]), ([], []))
        out.append(_to_user_resp(r, rid, rname))
    return ok({"list": out, "total": int(total)})


@router.get("/system/user/list")
def list_all_user(request: Request, db: Session = Depends(get_db)):
    raw_ids = request.query_params.getlist("userIds") if hasattr(request.query_params, "getlist") else []
    ids: list[int] = []
    for s in raw_ids:
        try:
            v = int(str(s))
            if v > 0:
                ids.append(v)
        except Exception:
            continue
    ids = list(dict.fromkeys(ids))

    dept = aliased(SysDept)
    cu = aliased(SysUser)
    uu = aliased(SysUser)
    stmt = (
        select(
            SysUser.id,
            SysUser.username,
            SysUser.nickname,
            SysUser.gender,
            SysUser.email,
            SysUser.phone,
            SysUser.avatar,
            SysUser.description,
            SysUser.status,
            SysUser.is_system,
            SysUser.dept_id,
            func.coalesce(dept.name, ""),
            SysUser.create_time,
            func.coalesce(cu.nickname, ""),
            SysUser.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysUser)
        .join(dept, dept.id == SysUser.dept_id, isouter=True)
        .join(cu, cu.id == SysUser.create_user, isouter=True)
        .join(uu, uu.id == SysUser.update_user, isouter=True)
    )
    stmt = stmt.where(SysUser.id.in_(ids)) if ids else stmt.order_by(SysUser.id.desc())

    rows = db.execute(stmt).all()
    base_rows: list[dict] = []
    for r in rows:
        base_rows.append(
            {
                "id": r[0],
                "username": r[1],
                "nickname": r[2],
                "gender": r[3],
                "email": r[4],
                "phone": r[5],
                "avatar": r[6],
                "description": r[7],
                "status": r[8],
                "is_system": r[9],
                "dept_id": r[10],
                "dept_name": r[11],
                "create_time": r[12],
                "create_user_string": r[13],
                "update_time": r[14],
                "update_user_string": r[15],
            }
        )

    user_ids = [int(r["id"]) for r in base_rows if int(r["id"] or 0) > 0]
    role_map = _role_map_for_users(db, user_ids)

    out = []
    for r in base_rows:
        rid, rname = role_map.get(int(r["id"]), ([], []))
        out.append(_to_user_resp(r, rid, rname))
    return ok(out)


@router.get("/system/user/{id}")
def get_user_detail(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    dept = aliased(SysDept)
    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysUser.id,
            SysUser.username,
            SysUser.nickname,
            SysUser.gender,
            SysUser.email,
            SysUser.phone,
            SysUser.avatar,
            SysUser.description,
            SysUser.status,
            SysUser.is_system,
            SysUser.dept_id,
            func.coalesce(dept.name, ""),
            SysUser.pwd_reset_time,
            SysUser.create_time,
            func.coalesce(cu.nickname, ""),
            SysUser.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysUser)
        .join(dept, dept.id == SysUser.dept_id, isouter=True)
        .join(cu, cu.id == SysUser.create_user, isouter=True)
        .join(uu, uu.id == SysUser.update_user, isouter=True)
        .where(SysUser.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "用户不存在")

    base = {
        "id": row[0],
        "username": row[1],
        "nickname": row[2],
        "gender": row[3],
        "email": row[4],
        "phone": row[5],
        "avatar": row[6],
        "description": row[7],
        "status": row[8],
        "is_system": row[9],
        "dept_id": row[10],
        "dept_name": row[11],
        "pwd_reset_time": row[12],
        "create_time": row[13],
        "create_user_string": row[14],
        "update_time": row[15],
        "update_user_string": row[16],
    }

    role_map = _role_map_for_users(db, [int(base["id"])])
    rid, rname = role_map.get(int(base["id"]), ([], []))
    resp = _to_user_resp(base, rid, rname)
    if base.get("pwd_reset_time") is not None:
        resp["pwdResetTime"] = format_time(base.get("pwd_reset_time"))
    return ok(resp)


@router.post("/system/user")
def create_user(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    username = str(body.get("username") or "").strip()
    nickname = str(body.get("nickname") or "").strip()
    password = str(body.get("password") or "").strip()
    gender = int(body.get("gender") or 0)
    status = int(body.get("status") or 0)
    dept_id = int(body.get("deptId") or 0)
    role_ids_raw = body.get("roleIds") if isinstance(body.get("roleIds"), list) else []
    role_ids = []
    for v in role_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                role_ids.append(iv)
        except Exception:
            continue
    role_ids = list(dict.fromkeys(role_ids))

    if username == "" or nickname == "":
        return fail("400", "用户名和昵称不能为空")
    if dept_id == 0:
        return fail("400", "所属部门不能为空")
    if status == 0:
        status = 1
    if password == "":
        return fail("400", "密码不能为空")

    raw_pwd, err = _validate_password(password)
    if err is not None:
        return fail(err[0], err[1])

    try:
        encoded_pwd = hash_password(raw_pwd or "")
    except Exception:
        return fail("500", "密码加密失败")

    uid = next_id()
    if uid <= 0:
        return fail("500", "新增用户失败")

    now = datetime.now()
    email = str(body.get("email") or "").strip()
    phone = str(body.get("phone") or "").strip()
    avatar = str(body.get("avatar") or "").strip()
    description = str(body.get("description") or "").strip()

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
                create_user=int(user_id),
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


@router.put("/system/user/{id}")
def update_user(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    username = str(body.get("username") or "").strip()
    nickname = str(body.get("nickname") or "").strip()
    gender = int(body.get("gender") or 0)
    status = int(body.get("status") or 0)
    dept_id = int(body.get("deptId") or 0)
    role_ids_raw = body.get("roleIds") if isinstance(body.get("roleIds"), list) else []
    role_ids = []
    for v in role_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                role_ids.append(iv)
        except Exception:
            continue
    role_ids = list(dict.fromkeys(role_ids))

    if username == "" or nickname == "":
        return fail("400", "用户名和昵称不能为空")
    if dept_id == 0:
        return fail("400", "所属部门不能为空")
    if status == 0:
        status = 1

    email = str(body.get("email") or "").strip()
    phone = str(body.get("phone") or "").strip()
    avatar = str(body.get("avatar") or "").strip()
    description = str(body.get("description") or "").strip()

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(id))
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
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.execute(delete(SysUserRole).where(SysUserRole.user_id == int(id)))
        for rid in role_ids:
            db.add(SysUserRole(id=next_id(), user_id=int(id), role_id=rid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改用户失败")

    return ok(True)


@router.delete("/system/user")
def delete_user(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict) or not isinstance(body.get("ids"), list) or len(body["ids"]) == 0:
        return fail("400", "ID 列表不能为空")
    ids = []
    for v in body["ids"]:
        try:
            iv = int(v)
            if iv > 0:
                ids.append(iv)
        except Exception:
            continue
    ids = list(dict.fromkeys(ids))
    if not ids:
        return fail("400", "ID 列表不能为空")

    try:
        for uid in ids:
            meta = db.execute(select(SysUser.is_system).where(SysUser.id == uid).limit(1)).first()
            if meta is None:
                continue
            if bool(meta[0]):
                continue
            db.execute(delete(SysUserRole).where(SysUserRole.user_id == uid))
            db.execute(delete(SysUser).where(SysUser.id == uid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除用户失败")
    return ok(True)


@router.patch("/system/user/{id}/password")
def reset_password(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    new_password = str(body.get("newPassword") or "").strip()
    raw_pwd, err = _validate_password(new_password)
    if err is not None:
        return fail(err[0], err[1])
    try:
        encoded = hash_password(raw_pwd or "")
    except Exception:
        return fail("500", "密码加密失败")

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(id))
            .values(password=encoded, pwd_reset_time=now, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "重置密码失败")
    return ok(True)


@router.patch("/system/user/{id}/role")
def update_user_role(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    role_ids_raw = body.get("roleIds") if isinstance(body.get("roleIds"), list) else []
    role_ids = []
    for v in role_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                role_ids.append(iv)
        except Exception:
            continue
    role_ids = list(dict.fromkeys(role_ids))

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.user_id == int(id)))
        for rid in role_ids:
            db.add(SysUserRole(id=next_id(), user_id=int(id), role_id=rid))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "分配角色失败")
    return ok(True)


@router.get("/system/user/export")
def export_user(db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            SysUser.username,
            SysUser.nickname,
            SysUser.gender,
            func.coalesce(SysUser.email, ""),
            func.coalesce(SysUser.phone, ""),
        ).order_by(SysUser.id.asc())
    ).all()

    content = "username,nickname,gender,email,phone\n"
    for r in rows:
        content += f"{r[0]},{r[1]},{int(r[2] or 0)},{r[3]},{r[4]}\n"

    headers = {"Content-Disposition": 'attachment; filename="users.csv"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/system/user/import/template")
def download_import_template():
    content = "username,nickname,gender,email,phone\n"
    headers = {"Content-Disposition": 'attachment; filename="user_import_template.csv"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@router.post("/system/user/import/parse")
def parse_import_user(file: Optional[UploadFile] = File(default=None)):
    if file is None:
        return fail("400", "文件不能为空")
    _ = file
    resp = {
        "importKey": str(time.time_ns()),
        "totalRows": 0,
        "validRows": 0,
        "duplicateUserRows": 0,
        "duplicateEmailRows": 0,
        "duplicatePhoneRows": 0,
    }
    return ok(resp)


@router.post("/system/user/import")
def import_user(body: Optional[dict] = Body(default=None)):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    _ = body
    return ok({"totalRows": 0, "insertRows": 0, "updateRows": 0})
