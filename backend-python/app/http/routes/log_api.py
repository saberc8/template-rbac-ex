"""系统日志接口：/system/log*（对齐 backend-go/internal/interfaces/http/log_handler.go）。"""

from __future__ import annotations

from typing import Union

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_log import SysLog
from app.db.models.sys_user import SysUser
from app.http.deps import get_db
from app.http.response import fail, ok
from app.http.utils import escape_csv, format_time, parse_time_ymdhms


router = APIRouter()


def _build_filters(request: Request) -> dict:
    description = (request.query_params.get("description") or "").strip()
    module = (request.query_params.get("module") or "").strip()
    ip = (request.query_params.get("ip") or "").strip()
    create_user = (request.query_params.get("createUserString") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()
    status = 0
    if status_str:
        try:
            status = int(status_str)
        except Exception:
            status = 0

    time_range = request.query_params.getlist("createTime") if hasattr(request.query_params, "getlist") else []
    start_time = parse_time_ymdhms(time_range[0]) if len(time_range) == 2 else None
    end_time = parse_time_ymdhms(time_range[1]) if len(time_range) == 2 else None

    return {
        "description": description,
        "module": module,
        "ip": ip,
        "create_user": create_user,
        "status": status,
        "start_time": start_time,
        "end_time": end_time,
    }


def _apply_filters(stmt, filters: dict, user_alias) -> object:
    desc = filters.get("description") or ""
    if desc:
        like = f"%{desc}%"
        stmt = stmt.where(
            func.lower(SysLog.description).like(func.lower(like)) | func.lower(SysLog.module).like(func.lower(like))
        )

    module = filters.get("module") or ""
    if module:
        stmt = stmt.where(SysLog.module == module)

    ip = filters.get("ip") or ""
    if ip:
        like = f"%{ip}%"
        stmt = stmt.where(func.lower(func.coalesce(SysLog.ip, "")).like(func.lower(like)) | func.lower(func.coalesce(SysLog.address, "")).like(func.lower(like)))

    cu = filters.get("create_user") or ""
    if cu:
        like = f"%{cu}%"
        stmt = stmt.where(
            func.lower(func.coalesce(user_alias.username, "")).like(func.lower(like))
            | func.lower(func.coalesce(user_alias.nickname, "")).like(func.lower(like))
        )

    status = int(filters.get("status") or 0)
    if status != 0:
        stmt = stmt.where(SysLog.status == status)

    start = filters.get("start_time")
    end = filters.get("end_time")
    if start is not None and end is not None:
        stmt = stmt.where(SysLog.create_time.between(start, end))

    return stmt


@router.get("/system/log")
def page_log(request: Request, db: Session = Depends(get_db)):
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

    filters = _build_filters(request)
    u = aliased(SysUser)

    base = select(SysLog.id).select_from(SysLog).join(u, u.id == SysLog.create_user, isouter=True)
    base = _apply_filters(base, filters, u)
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    total = int(total or 0)
    if total == 0:
        return ok({"list": [], "total": 0})

    stmt = (
        select(
            SysLog.id,
            SysLog.description,
            SysLog.module,
            func.coalesce(SysLog.time_taken, 0),
            func.coalesce(SysLog.ip, ""),
            func.coalesce(SysLog.address, ""),
            func.coalesce(SysLog.browser, ""),
            func.coalesce(SysLog.os, ""),
            func.coalesce(SysLog.status, 1),
            func.coalesce(SysLog.error_msg, ""),
            SysLog.create_time,
            func.coalesce(u.nickname, ""),
        )
        .select_from(SysLog)
        .join(u, u.id == SysLog.create_user, isouter=True)
    )
    stmt = _apply_filters(stmt, filters, u)
    stmt = stmt.order_by(SysLog.create_time.desc(), SysLog.id.desc()).limit(size).offset((page - 1) * size)

    rows = db.execute(stmt).all()
    out = []
    for r in rows:
        out.append(
            {
                "id": int(r[0]),
                "description": r[1],
                "module": r[2],
                "timeTaken": int(r[3] or 0),
                "ip": str(r[4] or ""),
                "address": str(r[5] or ""),
                "browser": str(r[6] or ""),
                "os": str(r[7] or ""),
                "status": int(r[8] or 1),
                "errorMsg": str(r[9] or ""),
                "createUserString": str(r[11] or ""),
                "createTime": format_time(r[10]),
            }
        )
    return ok({"list": out, "total": total})


@router.get("/system/log/{id}")
def get_log(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    u = aliased(SysUser)
    row = db.execute(
        select(
            SysLog.id,
            func.coalesce(SysLog.trace_id, ""),
            SysLog.description,
            SysLog.module,
            SysLog.request_url,
            SysLog.request_method,
            func.coalesce(SysLog.request_headers, ""),
            func.coalesce(SysLog.request_body, ""),
            SysLog.status_code,
            func.coalesce(SysLog.response_headers, ""),
            func.coalesce(SysLog.response_body, ""),
            func.coalesce(SysLog.time_taken, 0),
            func.coalesce(SysLog.ip, ""),
            func.coalesce(SysLog.address, ""),
            func.coalesce(SysLog.browser, ""),
            func.coalesce(SysLog.os, ""),
            func.coalesce(SysLog.status, 1),
            func.coalesce(SysLog.error_msg, ""),
            SysLog.create_time,
            func.coalesce(u.nickname, ""),
        )
        .select_from(SysLog)
        .join(u, u.id == SysLog.create_user, isouter=True)
        .where(SysLog.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "日志不存在")

    resp = {
        "id": int(row[0]),
        "traceId": str(row[1] or ""),
        "description": row[2],
        "module": row[3],
        "requestUrl": row[4],
        "requestMethod": row[5],
        "requestHeaders": str(row[6] or ""),
        "requestBody": str(row[7] or ""),
        "statusCode": int(row[8] or 0),
        "responseHeaders": str(row[9] or ""),
        "responseBody": str(row[10] or ""),
        "timeTaken": int(row[11] or 0),
        "ip": str(row[12] or ""),
        "address": str(row[13] or ""),
        "browser": str(row[14] or ""),
        "os": str(row[15] or ""),
        "status": int(row[16] or 1),
        "errorMsg": str(row[17] or ""),
        "createUserString": str(row[19] or ""),
        "createTime": format_time(row[18]),
    }
    return ok(resp)


def _export_log_csv(request: Request, db: Session, is_login: bool) -> Union[Response, dict]:
    filters = _build_filters(request)
    u = aliased(SysUser)
    stmt = (
        select(
            SysLog.id,
            SysLog.description,
            SysLog.module,
            func.coalesce(SysLog.time_taken, 0),
            func.coalesce(SysLog.ip, ""),
            func.coalesce(SysLog.address, ""),
            func.coalesce(SysLog.browser, ""),
            func.coalesce(SysLog.os, ""),
            func.coalesce(SysLog.status, 1),
            func.coalesce(SysLog.error_msg, ""),
            SysLog.create_time,
            func.coalesce(u.nickname, ""),
        )
        .select_from(SysLog)
        .join(u, u.id == SysLog.create_user, isouter=True)
    )
    stmt = _apply_filters(stmt, filters, u)
    stmt = stmt.order_by(SysLog.create_time.desc(), SysLog.id.desc())

    try:
        rows = db.execute(stmt).all()
    except Exception:
        return fail("500", "导出日志失败")

    filename = "login-log.csv" if is_login else "operation-log.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    if not rows:
        return Response(content="", media_type="text/csv; charset=utf-8", headers=headers)

    lines: list[str] = []
    if is_login:
        lines.append("ID,登录时间,用户昵称,登录行为,状态,登录 IP,登录地点,浏览器,终端系统")
        for r in rows:
            status_text = "成功" if int(r[8] or 1) == 1 else "失败"
            line = ",".join(
                [
                    str(int(r[0])),
                    format_time(r[10]),
                    escape_csv(str(r[11] or "")),
                    escape_csv(str(r[1] or "")),
                    status_text,
                    escape_csv(str(r[4] or "")),
                    escape_csv(str(r[5] or "")),
                    escape_csv(str(r[6] or "")),
                    escape_csv(str(r[7] or "")),
                ]
            )
            lines.append(line)
    else:
        lines.append("ID,操作时间,操作人,操作内容,所属模块,状态,操作 IP,操作地点,耗时（ms）,浏览器,终端系统")
        for r in rows:
            status_text = "成功" if int(r[8] or 1) == 1 else "失败"
            line = ",".join(
                [
                    str(int(r[0])),
                    format_time(r[10]),
                    escape_csv(str(r[11] or "")),
                    escape_csv(str(r[1] or "")),
                    escape_csv(str(r[2] or "")),
                    status_text,
                    escape_csv(str(r[4] or "")),
                    escape_csv(str(r[5] or "")),
                    str(int(r[3] or 0)),
                    escape_csv(str(r[6] or "")),
                    escape_csv(str(r[7] or "")),
                ]
            )
            lines.append(line)

    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/system/log/export/login")
def export_login_log(request: Request, db: Session = Depends(get_db)):
    return _export_log_csv(request, db, True)


@router.get("/system/log/export/operation")
def export_operation_log(request: Request, db: Session = Depends(get_db)):
    return _export_log_csv(request, db, False)
