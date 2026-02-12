"""存储配置用例编排（storage 写接口）。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_storage import SysStorage
from app.http.response import APIResponse, fail, ok


def create_storage(
    *,
    db: Session,
    operator_user_id: int,
    name: str,
    code: str,
    typ: int,
    sort_val: int,
    status: int,
    access_key: str,
    secret_key: str,
    endpoint: str,
    region: str,
    bucket_name: str,
    domain: str,
    description: str,
    is_default: bool,
) -> APIResponse:
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    typ = typ or 1
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

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
                create_user=int(operator_user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增存储配置失败")

    return ok({"id": sid})


def update_storage(
    *,
    db: Session,
    operator_user_id: int,
    storage_id: int,
    name: str,
    code: str,
    typ: int,
    sort_val: int,
    status: int,
    access_key: str,
    endpoint: str,
    region: str,
    bucket_name: str,
    domain: str,
    description: str,
    secret_key_present: bool,
    secret_key_val: str | None,
    is_default_present: bool,
    is_default: bool,
) -> APIResponse:
    if storage_id <= 0:
        return fail("400", "ID 参数不正确")
    if name == "":
        return fail("400", "名称不能为空")
    if code == "":
        return fail("400", "名称和编码不能为空")

    typ = typ or 1
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

    if secret_key_present and typ == 2 and secret_key_val is not None and len(secret_key_val) > 255:
        return fail("400", "私有密钥长度不能超过 255 个字符")

    exclude = int(storage_id)
    exists = db.execute(
        select(SysStorage.id).where(SysStorage.code == code).where(SysStorage.id != exclude).limit(1)
    ).first()
    if exists is not None:
        return fail("400", "修改失败，编码已存在")

    old = db.execute(select(SysStorage).where(SysStorage.id == int(storage_id)).limit(1)).scalar_one_or_none()
    if old is None:
        return fail("404", "存储配置不存在")

    secret_final = old.secret_key or ""
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
        "update_user": int(operator_user_id),
        "update_time": now,
    }
    if is_default_present:
        values["is_default"] = bool(is_default)

    try:
        db.execute(update(SysStorage).where(SysStorage.id == int(storage_id)).values(**values))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改存储配置失败")
    return ok(True)


def delete_storage(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "ID 列表不能为空")

    default_hit = db.execute(
        select(SysStorage.id).where(SysStorage.id.in_(ids)).where(SysStorage.is_default.is_(True)).limit(1)
    ).first()
    if default_hit is not None:
        return fail("400", "不允许删除默认存储")

    try:
        db.execute(delete(SysStorage).where(SysStorage.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除存储配置失败")
    return ok(True)


def update_storage_status(
    *,
    db: Session,
    operator_user_id: int,
    storage_id: int,
    status: int,
) -> APIResponse:
    if storage_id <= 0:
        return fail("400", "ID 参数不正确")
    if status not in (1, 2):
        return fail("400", "状态参数不正确")

    item = db.execute(select(SysStorage.is_default).where(SysStorage.id == int(storage_id)).limit(1)).first()
    if item is None:
        return fail("404", "存储配置不存在")
    if bool(item[0]) and status != 1:
        return fail("400", "不允许禁用默认存储")

    now = datetime.now()
    try:
        db.execute(
            update(SysStorage)
            .where(SysStorage.id == int(storage_id))
            .values(status=status, update_user=int(operator_user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改存储状态失败")
    return ok(True)


def set_default_storage(*, db: Session, operator_user_id: int, storage_id: int) -> APIResponse:
    if storage_id <= 0:
        return fail("400", "ID 参数不正确")

    exists = db.execute(select(SysStorage.id).where(SysStorage.id == int(storage_id)).limit(1)).first()
    if exists is None:
        return fail("404", "存储配置不存在")

    now = datetime.now()
    try:
        db.execute(update(SysStorage).values(is_default=False))
        db.execute(
            update(SysStorage)
            .where(SysStorage.id == int(storage_id))
            .values(is_default=True, update_user=int(operator_user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "设置默认存储失败")
    return ok(True)
