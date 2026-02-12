"""存储配置接口：/system/storage/*（对齐 backend-go/internal/interfaces/http/storage_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time
from app.http.validators import parse_int, parse_positive_int_list, require_dict_body, require_non_empty_str
from app.services import storage_service

router = APIRouter()


def _to_storage_resp(row: dict, mask_secret: bool) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    secret = str(row.get("secret_key") or "")
    secret = ("******" if secret.strip() else "") if mask_secret else ""
    return {
        "id": int(row.get("id") or 0),
        "name": row.get("name") or "",
        "code": row.get("code") or "",
        "type": int(row.get("type") or 0),
        "accessKey": str(row.get("access_key") or ""),
        "secretKey": secret,
        "endpoint": str(row.get("endpoint") or ""),
        "region": str(row.get("region") or ""),
        "bucketName": str(row.get("bucket_name") or ""),
        "domain": str(row.get("domain") or ""),
        "description": str(row.get("description") or ""),
        "isDefault": bool(row.get("is_default") or False),
        "sort": int(row.get("sort") or 0),
        "status": int(row.get("status") or 0),
        "createUserString": str(row.get("create_user_string") or ""),
        "createTime": format_time(ct) if isinstance(ct, datetime) else "",
        "updateUserString": str(row.get("update_user_string") or ""),
        "updateTime": format_time(ut) if isinstance(ut, datetime) else "",
    }


def _get_storage_detail(db: Session, storage_id: int) -> Optional[dict]:
    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysStorage.id,
            SysStorage.name,
            SysStorage.code,
            SysStorage.type,
            func.coalesce(SysStorage.access_key, ""),
            func.coalesce(SysStorage.secret_key, ""),
            func.coalesce(SysStorage.endpoint, ""),
            func.coalesce(SysStorage.region, ""),
            SysStorage.bucket_name,
            func.coalesce(SysStorage.domain, ""),
            func.coalesce(SysStorage.description, ""),
            SysStorage.is_default,
            func.coalesce(SysStorage.sort, 999),
            SysStorage.status,
            SysStorage.create_time,
            func.coalesce(cu.nickname, ""),
            SysStorage.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysStorage)
        .join(cu, cu.id == SysStorage.create_user, isouter=True)
        .join(uu, uu.id == SysStorage.update_user, isouter=True)
        .where(SysStorage.id == int(storage_id))
        .limit(1)
    ).first()
    if row is None:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "code": row[2],
        "type": row[3],
        "access_key": row[4],
        "secret_key": row[5],
        "endpoint": row[6],
        "region": row[7],
        "bucket_name": row[8],
        "domain": row[9],
        "description": row[10],
        "is_default": row[11],
        "sort": row[12],
        "status": row[13],
        "create_time": row[14],
        "create_user_string": row[15],
        "update_time": row[16],
        "update_user_string": row[17],
    }


@router.get("/system/storage/list")
def list_storage(request: Request, db: Session = Depends(get_db)):
    description = (request.query_params.get("description") or "").strip()
    type_str = (request.query_params.get("type") or "").strip()

    storage_type = 0
    if type_str:
        try:
            storage_type = int(type_str)
        except Exception:
            storage_type = 0

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    stmt = (
        select(
            SysStorage.id,
            SysStorage.name,
            SysStorage.code,
            SysStorage.type,
            func.coalesce(SysStorage.access_key, ""),
            func.coalesce(SysStorage.secret_key, ""),
            func.coalesce(SysStorage.endpoint, ""),
            func.coalesce(SysStorage.region, ""),
            SysStorage.bucket_name,
            func.coalesce(SysStorage.domain, ""),
            func.coalesce(SysStorage.description, ""),
            SysStorage.is_default,
            func.coalesce(SysStorage.sort, 999),
            SysStorage.status,
            SysStorage.create_time,
            func.coalesce(cu.nickname, ""),
            SysStorage.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysStorage)
        .join(cu, cu.id == SysStorage.create_user, isouter=True)
        .join(uu, uu.id == SysStorage.update_user, isouter=True)
        .order_by(SysStorage.sort.asc(), SysStorage.id.asc())
    )
    if description:
        like = f"%{description}%"
        stmt = stmt.where(
            func.lower(SysStorage.name).like(func.lower(like))
            | func.lower(SysStorage.code).like(func.lower(like))
            | func.lower(func.coalesce(SysStorage.description, "")).like(func.lower(like))
        )
    if storage_type:
        stmt = stmt.where(SysStorage.type == int(storage_type))

    rows = db.execute(stmt).all()
    out = []
    for r in rows:
        out.append(
            _to_storage_resp(
                {
                    "id": r[0],
                    "name": r[1],
                    "code": r[2],
                    "type": r[3],
                    "access_key": r[4],
                    "secret_key": r[5],
                    "endpoint": r[6],
                    "region": r[7],
                    "bucket_name": r[8],
                    "domain": r[9],
                    "description": r[10],
                    "is_default": r[11],
                    "sort": r[12],
                    "status": r[13],
                    "create_time": r[14],
                    "create_user_string": r[15],
                    "update_time": r[16],
                    "update_user_string": r[17],
                },
                False,
            )
        )
    return ok(out)


@router.get("/system/storage/{id}")
def get_storage(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    detail = _get_storage_detail(db, int(id))
    if detail is None:
        return fail("404", "存储配置不存在")
    return ok(_to_storage_resp(detail, True))


@router.post("/system/storage")
def create_storage(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    name, err = require_non_empty_str(body.get("name"), "名称和编码不能为空")
    if err is not None:
        return err
    code, err = require_non_empty_str(body.get("code"), "名称和编码不能为空")
    if err is not None:
        return err

    typ, err = parse_int(body.get("type"), "请求参数不正确", default=1)
    if err is not None:
        return err
    sort_val, err = parse_int(body.get("sort"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err

    access_key = str(body.get("accessKey") or "").strip()
    secret_key = str(body.get("secretKey") or "").strip()
    endpoint = str(body.get("endpoint") or "").strip()
    region = str(body.get("region") or "").strip()
    bucket_name = str(body.get("bucketName") or "").strip()
    domain = str(body.get("domain") or "").strip()
    description = str(body.get("description") or "").strip()
    is_default = bool(body.get("isDefault")) if body.get("isDefault") is not None else False

    return storage_service.create_storage(
        db=db,
        operator_user_id=int(user_id),
        name=name or "",
        code=code or "",
        typ=int(typ or 0),
        sort_val=int(sort_val or 0),
        status=int(status or 0),
        access_key=access_key,
        secret_key=secret_key,
        endpoint=endpoint,
        region=region,
        bucket_name=bucket_name,
        domain=domain,
        description=description,
        is_default=is_default,
    )


@router.put("/system/storage/{id}")
def update_storage(
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

    name, err = require_non_empty_str(body.get("name"), "名称不能为空")
    if err is not None:
        return err
    code, err = require_non_empty_str(body.get("code"), "名称和编码不能为空")
    if err is not None:
        return err

    typ, err = parse_int(body.get("type"), "请求参数不正确", default=1)
    if err is not None:
        return err
    sort_val, err = parse_int(body.get("sort"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err

    access_key = str(body.get("accessKey") or "").strip()
    endpoint = str(body.get("endpoint") or "").strip()
    region = str(body.get("region") or "").strip()
    bucket_name = str(body.get("bucketName") or "").strip()
    domain = str(body.get("domain") or "").strip()
    description = str(body.get("description") or "").strip()

    secret_key_present = "secretKey" in body
    secret_key_val = str(body.get("secretKey") or "").strip() if secret_key_present else None
    is_default_present = "isDefault" in body
    is_default = bool(body.get("isDefault")) if is_default_present else False

    return storage_service.update_storage(
        db=db,
        operator_user_id=int(user_id),
        storage_id=int(id),
        name=name or "",
        code=code or "",
        typ=int(typ or 0),
        sort_val=int(sort_val or 0),
        status=int(status or 0),
        access_key=access_key,
        endpoint=endpoint,
        region=region,
        bucket_name=bucket_name,
        domain=domain,
        description=description,
        secret_key_present=secret_key_present,
        secret_key_val=secret_key_val,
        is_default_present=is_default_present,
        is_default=is_default,
    )


@router.delete("/system/storage")
def delete_storage(
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

    return storage_service.delete_storage(db=db, ids=ids)


@router.put("/system/storage/{id}/status")
def update_storage_status(
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

    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err

    return storage_service.update_storage_status(
        db=db,
        operator_user_id=int(user_id),
        storage_id=int(id),
        status=int(status or 0),
    )


@router.put("/system/storage/{id}/default")
def set_default_storage(
    id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    return storage_service.set_default_storage(db=db, operator_user_id=int(user_id), storage_id=int(id))
