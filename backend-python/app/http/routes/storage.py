"""存储配置接口：/system/storage/*（对齐 backend-go/internal/interfaces/http/storage_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time


router = APIRouter()


def _to_storage_resp(row: dict, mask_secret: bool) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    secret = str(row.get("secret_key") or "")
    if mask_secret:
        secret = "******" if secret.strip() else ""
    else:
        secret = ""
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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip()
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    typ = int(body.get("type") or 0) or 1
    sort_val = int(body.get("sort") or 0)
    if sort_val <= 0:
        sort_val = 999
    status = int(body.get("status") or 0)
    if status == 0:
        status = 1

    access_key = str(body.get("accessKey") or "").strip()
    secret_key = str(body.get("secretKey") or "").strip()
    endpoint = str(body.get("endpoint") or "").strip()
    region = str(body.get("region") or "").strip()
    bucket_name = str(body.get("bucketName") or "").strip()
    domain = str(body.get("domain") or "").strip()
    description = str(body.get("description") or "").strip()
    is_default = bool(body.get("isDefault")) if body.get("isDefault") is not None else False

    if typ == 2 and len(secret_key) > 255:
        return fail("400", "私有密钥长度不能超过 255 个字符")

    if typ == 2 and secret_key == "":
        return fail("400", "私有密钥不能为空")

    exists = db.execute(select(SysStorage.id).where(SysStorage.code == code).limit(1)).first()
    if exists is not None:
        return fail("400", "新增失败，编码已存在")

    sid = next_id()
    if sid == 0:
        return fail("500", "生成存储配置 ID 失败")
    now = datetime.now()
    try:
        db.add(
            SysStorage(
                id=sid,
                name=name,
                code=code,
                type=typ,
                access_key=access_key,
                secret_key=secret_key,
                endpoint=endpoint,
                region=region,
                bucket_name=bucket_name,
                domain=domain,
                description=description,
                is_default=is_default,
                sort=sort_val,
                status=status,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增存储配置失败")

    return ok({"id": sid})


@router.put("/system/storage/{id}")
def update_storage(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    name = str(body.get("name") or "").strip()
    if name == "":
        return fail("400", "名称不能为空")
    code = str(body.get("code") or "").strip()
    if code == "":
        return fail("400", "名称和编码不能为空")

    typ = int(body.get("type") or 0) or 1
    sort_val = int(body.get("sort") or 0)
    if sort_val <= 0:
        sort_val = 999
    status = int(body.get("status") or 0)
    if status == 0:
        status = 1

    access_key = str(body.get("accessKey") or "").strip()
    endpoint = str(body.get("endpoint") or "").strip()
    region = str(body.get("region") or "").strip()
    bucket_name = str(body.get("bucketName") or "").strip()
    domain = str(body.get("domain") or "").strip()
    description = str(body.get("description") or "").strip()

    secret_key_present = "secretKey" in body
    secret_key_val = str(body.get("secretKey") or "").strip() if secret_key_present else None
    if secret_key_present and typ == 2 and secret_key_val is not None and len(secret_key_val) > 255:
        return fail("400", "私有密钥长度不能超过 255 个字符")

    exclude = int(id)
    exists = db.execute(select(SysStorage.id).where(SysStorage.code == code).where(SysStorage.id != exclude).limit(1)).first()
    if exists is not None:
        return fail("400", "修改失败，编码已存在")

    old = db.execute(select(SysStorage).where(SysStorage.id == int(id)).limit(1)).scalar_one_or_none()
    if old is None:
        return fail("404", "存储配置不存在")

    secret_final = (old.secret_key or "")
    if secret_key_present and secret_key_val is not None:
        secret_final = secret_key_val

    if typ == 2 and str(secret_final).strip() == "":
        return fail("400", "私有密钥不能为空")

    now = datetime.now()
    values = {
        "name": name,
        "code": code,
        "type": typ,
        "access_key": access_key,
        "secret_key": secret_final,
        "endpoint": endpoint,
        "region": region,
        "bucket_name": bucket_name,
        "domain": domain,
        "description": description,
        "sort": sort_val,
        "status": status,
        "update_user": int(user_id),
        "update_time": now,
    }
    if "isDefault" in body:
        values["is_default"] = bool(body.get("isDefault"))

    try:
        db.execute(update(SysStorage).where(SysStorage.id == int(id)).values(**values))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改存储配置失败")
    return ok(True)


@router.delete("/system/storage")
def delete_storage(
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

    default_hit = db.execute(select(SysStorage.id).where(SysStorage.id.in_(ids)).where(SysStorage.is_default.is_(True)).limit(1)).first()
    if default_hit is not None:
        return fail("400", "不允许删除默认存储")

    try:
        db.execute(delete(SysStorage).where(SysStorage.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除存储配置失败")
    return ok(True)


@router.put("/system/storage/{id}/status")
def update_storage_status(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    status = int(body.get("status") or 0)
    if status not in (1, 2):
        return fail("400", "状态参数不正确")

    item = db.execute(select(SysStorage.is_default).where(SysStorage.id == int(id)).limit(1)).first()
    if item is None:
        return fail("404", "存储配置不存在")
    if bool(item[0]) and status != 1:
        return fail("400", "不允许禁用默认存储")

    now = datetime.now()
    try:
        db.execute(update(SysStorage).where(SysStorage.id == int(id)).values(status=status, update_user=int(user_id), update_time=now))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改存储状态失败")
    return ok(True)


@router.put("/system/storage/{id}/default")
def set_default_storage(
    id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    exists = db.execute(select(SysStorage.id).where(SysStorage.id == int(id)).limit(1)).first()
    if exists is None:
        return fail("404", "存储配置不存在")

    now = datetime.now()
    try:
        db.execute(update(SysStorage).values(is_default=False))
        db.execute(update(SysStorage).where(SysStorage.id == int(id)).values(is_default=True, update_user=int(user_id), update_time=now))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "设置默认存储失败")
    return ok(True)
