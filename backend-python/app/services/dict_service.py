"""字典与字典项用例编排（dict_api 写接口）。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_dict import SysDict
from app.db.models.sys_dict_item import SysDictItem
from app.http.response import APIResponse, fail, ok


def create_dict(*, db: Session, user_id: int, name: str, code: str, description: str) -> APIResponse:
    name = str(name or "").strip()
    code = str(code or "").strip()
    description = str(description or "").strip()
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    exists = db.execute(select(SysDict.id).where(SysDict.name == name).limit(1)).first()
    if exists is not None:
        return fail("400", f"新增失败，[{name}] 已存在")
    exists = db.execute(select(SysDict.id).where(SysDict.code == code).limit(1)).first()
    if exists is not None:
        return fail("400", f"新增失败，[{code}] 已存在")

    did = next_id()
    if did <= 0:
        return fail("500", "新增字典失败")
    now = datetime.now()
    try:
        db.add(
            SysDict(
                id=did,
                name=name,
                code=code,
                description=description,
                is_system=False,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增字典失败")
    return ok({"id": did})


def update_dict(*, db: Session, user_id: int, dict_id: int, name: str, description: str) -> APIResponse:
    if dict_id <= 0:
        return fail("400", "ID 参数不正确")
    name = str(name or "").strip()
    description = str(description or "").strip()
    if name == "":
        return fail("400", "名称不能为空")

    now = datetime.now()
    try:
        db.execute(
            update(SysDict)
            .where(SysDict.id == int(dict_id))
            .values(name=name, description=description, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改字典失败")
    return ok(True)


def delete_dicts(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "ID 列表不能为空")
    try:
        db.execute(delete(SysDictItem).where(SysDictItem.dict_id.in_(ids)))
        db.execute(delete(SysDict).where(SysDict.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除字典失败")
    return ok(True)


def create_dict_item(
    *,
    db: Session,
    user_id: int,
    label: str,
    value: str,
    color: str,
    description: str,
    sort_val: int,
    status: int,
    dict_id: int,
) -> APIResponse:
    label = str(label or "").strip()
    value = str(value or "").strip()
    color = str(color or "").strip()
    description = str(description or "").strip()

    if label == "" or value == "" or int(dict_id or 0) == 0:
        return fail("400", "标签、值和字典 ID 不能为空")
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

    iid = next_id()
    if iid <= 0:
        return fail("500", "新增字典项失败")
    now = datetime.now()
    try:
        db.add(
            SysDictItem(
                id=iid,
                label=label,
                value=value,
                color=color or None,
                sort=sort_val,
                description=description,
                status=status,
                dict_id=int(dict_id),
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增字典项失败")
    return ok({"id": iid})


def update_dict_item(
    *,
    db: Session,
    user_id: int,
    item_id: int,
    label: str,
    value: str,
    color: str,
    description: str,
    sort_val: int,
    status: int,
) -> APIResponse:
    if item_id <= 0:
        return fail("400", "ID 参数不正确")

    label = str(label or "").strip()
    value = str(value or "").strip()
    color = str(color or "").strip()
    description = str(description or "").strip()

    if label == "" or value == "":
        return fail("400", "标签和值不能为空")
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

    now = datetime.now()
    try:
        db.execute(
            update(SysDictItem)
            .where(SysDictItem.id == int(item_id))
            .values(
                label=label,
                value=value,
                color=color,
                sort=sort_val,
                description=description,
                status=status,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改字典项失败")
    return ok(True)


def delete_dict_items(*, db: Session, ids: list[int]) -> APIResponse:
    if not ids:
        return fail("400", "ID 列表不能为空")
    try:
        db.execute(delete(SysDictItem).where(SysDictItem.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除字典项失败")
    return ok(True)
