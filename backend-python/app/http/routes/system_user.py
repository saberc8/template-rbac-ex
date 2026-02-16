"""用户管理接口：/system/user/*（对齐 backend-go/internal/interfaces/http/system_user_handler.go）。"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_dept import SysDept
from app.db.models.sys_role import SysRole
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time, get_query_list
from app.http.validators import (
    parse_int,
    parse_int_or_default,
    parse_page_size,
    parse_positive_int_list,
    parse_positive_int_list_allow_empty,
    require_dict_body,
    require_non_empty_str,
)
from app.services import system_user_service

router = APIRouter()


def _parse_role_ids(v: object) -> list[int]:
    return parse_positive_int_list_allow_empty(v)


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


def _query_user_page(
    db: Session,
    *,
    page: int,
    size: int,
    description: str,
    status_filter: Optional[int],
    dept_id: Optional[int],
) -> tuple[list[dict], int]:
    desc = (description or "").strip()

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
    page, size = parse_page_size(
        request.query_params.get("page"),
        request.query_params.get("size"),
        default_page=1,
        default_size=10,
        min_page=1,
        min_size=1,
    )

    desc = (request.query_params.get("description") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()
    dept_str = (request.query_params.get("deptId") or "").strip()

    status_filter_n = parse_int_or_default(status_str, 0)
    status_filter = int(status_filter_n) if int(status_filter_n) != 0 else None

    dept_id_n = parse_int_or_default(dept_str, 0)
    dept_id = int(dept_id_n) if int(dept_id_n) != 0 else None

    rows, total = _query_user_page(
        db,
        page=page,
        size=size,
        description=desc,
        status_filter=status_filter,
        dept_id=dept_id,
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
    raw_ids = get_query_list(request, "userIds")
    ids = parse_positive_int_list_allow_empty(raw_ids)

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
    body, err = require_dict_body(body)
    if err is not None:
        return err

    username, err = require_non_empty_str(body.get("username"), "用户名和昵称不能为空")
    if err is not None:
        return err
    nickname, err = require_non_empty_str(body.get("nickname"), "用户名和昵称不能为空")
    if err is not None:
        return err
    password, err = require_non_empty_str(body.get("password"), "密码不能为空")
    if err is not None:
        return err

    gender, err = parse_int(body.get("gender"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err
    dept_id, err = parse_int(body.get("deptId"), "请求参数不正确", default=0)
    if err is not None:
        return err

    role_ids = _parse_role_ids(body.get("roleIds"))
    email = str(body.get("email") or "").strip()
    phone = str(body.get("phone") or "").strip()
    avatar = str(body.get("avatar") or "").strip()
    description = str(body.get("description") or "").strip()

    return system_user_service.create_user(
        db=db,
        operator_user_id=int(user_id),
        username=username or "",
        nickname=nickname or "",
        password=password or "",
        gender=int(gender or 0),
        status=int(status or 0),
        dept_id=int(dept_id or 0),
        role_ids=role_ids,
        email=email,
        phone=phone,
        avatar=avatar,
        description=description,
    )


@router.put("/system/user/{id}")
def update_user(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    body, err = require_dict_body(body)
    if err is not None:
        return err

    username, err = require_non_empty_str(body.get("username"), "用户名和昵称不能为空")
    if err is not None:
        return err
    nickname, err = require_non_empty_str(body.get("nickname"), "用户名和昵称不能为空")
    if err is not None:
        return err

    gender, err = parse_int(body.get("gender"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err
    dept_id, err = parse_int(body.get("deptId"), "请求参数不正确", default=0)
    if err is not None:
        return err

    role_ids = _parse_role_ids(body.get("roleIds"))
    email = str(body.get("email") or "").strip()
    phone = str(body.get("phone") or "").strip()
    avatar = str(body.get("avatar") or "").strip()
    description = str(body.get("description") or "").strip()

    return system_user_service.update_user(
        db=db,
        operator_user_id=int(user_id),
        user_id=int(id),
        username=username or "",
        nickname=nickname or "",
        gender=int(gender or 0),
        status=int(status or 0),
        dept_id=int(dept_id or 0),
        role_ids=role_ids,
        email=email,
        phone=phone,
        avatar=avatar,
        description=description,
    )


@router.delete("/system/user")
def delete_user(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    ids, err = parse_positive_int_list(body.get("ids"), "ID 列表不能为空")
    if err is not None:
        return err

    return system_user_service.delete_users(db=db, ids=ids)


@router.patch("/system/user/{id}/password")
def reset_password(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    body, err = require_dict_body(body)
    if err is not None:
        return err

    new_password, err = require_non_empty_str(body.get("newPassword"), "密码不能为空")
    if err is not None:
        return err

    return system_user_service.reset_password(
        db=db,
        operator_user_id=int(user_id),
        user_id=int(id),
        new_password=new_password or "",
    )


@router.patch("/system/user/{id}/role")
def update_user_role(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    body, err = require_dict_body(body)
    if err is not None:
        return err

    role_ids = _parse_role_ids(body.get("roleIds"))
    return system_user_service.update_user_role(db=db, user_id=int(id), role_ids=role_ids)


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
    body, err = require_dict_body(body)
    if err is not None:
        return err
    _ = body
    return ok({"totalRows": 0, "insertRows": 0, "updateRows": 0})
