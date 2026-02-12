"""文件管理接口：/system/file/* 与 /common/file（对齐 backend-go/internal/interfaces/http/file_handler.go）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_file import SysFile
from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.files.storage import (
    delete_physical as _delete_physical,
)  # noqa: F401
from app.files.storage import (
    join_full_path as _join_full_path,
)
from app.files.storage import (
    local_root_dir as _local_root_dir,
)
from app.files.storage import (
    put_to_minio as _put_to_minio,
)
from app.files.storage import (
    save_to_local as _save_to_local,
)
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import (
    build_storage_file_url,
    format_time,
    normalize_parent_path,
)
from app.http.validators import parse_positive_int_list, require_dict_body, require_non_empty_str
from app.services import file_service

router = APIRouter()

# 兼容旧调用点：允许其它模块继续通过 `app.http.routes.file_api` 访问存储底座函数。
__all__ = [
    "_delete_physical",
    "_join_full_path",
    "_local_root_dir",
    "_put_to_minio",
    "_save_to_local",
]


def _get_default_storage(db: Session) -> Optional[SysStorage]:
    return db.execute(select(SysStorage).where(SysStorage.is_default.is_(True)).limit(1)).scalar_one_or_none()


def _build_file_item(row: dict, storage_cfg: Optional[SysStorage]) -> dict:
    url = build_storage_file_url(storage_cfg, row.get("path") or "")
    thumb_name = str(row.get("thumbnail_name") or "")
    if thumb_name:
        parent = str(row.get("parent_path") or "")
        if parent == "/":
            parent = ""
        thumb_path = parent + "/" + thumb_name
        thumb_url = build_storage_file_url(storage_cfg, thumb_path)
    else:
        thumb_url = url

    storage_name = str(row.get("storage_name") or "")
    if storage_name.strip() == "":
        storage_name = "本地存储"

    return {
        "id": int(row.get("id") or 0),
        "name": str(row.get("name") or ""),
        "originalName": str(row.get("original_name") or ""),
        "size": row.get("size"),
        "url": url,
        "parentPath": str(row.get("parent_path") or ""),
        "path": str(row.get("path") or ""),
        "sha256": str(row.get("sha256") or ""),
        "contentType": str(row.get("content_type") or ""),
        "metadata": str(row.get("metadata") or ""),
        "thumbnailSize": row.get("thumbnail_size"),
        "thumbnailName": str(row.get("thumbnail_name") or ""),
        "thumbnailMetadata": str(row.get("thumbnail_metadata") or ""),
        "thumbnailUrl": thumb_url,
        "extension": str(row.get("extension") or ""),
        "type": int(row.get("type") or 0),
        "storageId": int(row.get("storage_id") or 0),
        "storageName": storage_name,
        "createUserString": str(row.get("create_user_string") or ""),
        "createTime": format_time(row.get("create_time")),
        "updateUserString": str(row.get("update_user_string") or ""),
        "updateTime": format_time(row.get("update_time")) if row.get("update_time") is not None else "",
    }


@router.post("/system/file/upload")
@router.post("/common/file")
def upload_file(
    file: Optional[UploadFile] = File(default=None),
    parentPath: Optional[str] = Form(default="/"),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if file is None:
        return fail("400", "文件不能为空")
    return file_service.upload_file(db=db, user_id=int(user_id), file=file, parent_path=parentPath or "/")


@router.get("/system/file")
def list_file(request: Request, db: Session = Depends(get_db)):
    original_name = (request.query_params.get("originalName") or "").strip()
    type_str = (request.query_params.get("type") or "").strip()
    parent_path = (request.query_params.get("parentPath") or "").strip()

    try:
        page = int(request.query_params.get("page") or "1")
    except Exception:
        page = 1
    try:
        size = int(request.query_params.get("size") or "30")
    except Exception:
        size = 30
    if page <= 0:
        page = 1
    if size <= 0:
        size = 30

    file_type = 0
    if type_str and type_str != "0":
        try:
            t = int(type_str)
            if t > 0:
                file_type = t
        except Exception:
            file_type = 0

    pp = normalize_parent_path(parent_path) if parent_path else ""

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    st = aliased(SysStorage)

    stmt = (
        select(
            SysFile.id,
            SysFile.name,
            SysFile.original_name,
            SysFile.size,
            SysFile.parent_path,
            SysFile.path,
            func.coalesce(SysFile.extension, ""),
            func.coalesce(SysFile.content_type, ""),
            SysFile.type,
            func.coalesce(SysFile.sha256, ""),
            func.coalesce(SysFile.metadata_, ""),
            func.coalesce(SysFile.thumbnail_name, ""),
            SysFile.thumbnail_size,
            func.coalesce(SysFile.thumbnail_metadata, ""),
            SysFile.storage_id,
            func.coalesce(st.name, ""),
            SysFile.create_time,
            func.coalesce(cu.nickname, ""),
            SysFile.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysFile)
        .join(cu, cu.id == SysFile.create_user, isouter=True)
        .join(uu, uu.id == SysFile.update_user, isouter=True)
        .join(st, st.id == SysFile.storage_id, isouter=True)
    )
    if original_name:
        like = f"%{original_name}%"
        stmt = stmt.where(func.lower(SysFile.original_name).like(func.lower(like)))
    if file_type:
        stmt = stmt.where(SysFile.type == int(file_type))
    if pp:
        stmt = stmt.where(SysFile.parent_path == pp)

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    total = int(total or 0)
    if total == 0:
        return ok({"list": [], "total": 0})

    dialect = (db.get_bind().dialect.name or "").lower()
    if dialect.startswith("postgres"):
        order = [SysFile.type.asc(), SysFile.update_time.desc().nullslast(), SysFile.id.desc()]
    else:
        order = [SysFile.type.asc(), SysFile.update_time.desc(), SysFile.id.desc()]
    rows = db.execute(stmt.order_by(*order).limit(size).offset((page - 1) * size)).all()

    unique_storage_ids = sorted({int(r[14]) for r in rows if int(r[14] or 0) > 0})
    storage_map: dict[int, SysStorage] = {}
    if unique_storage_ids:
        storages = db.execute(select(SysStorage).where(SysStorage.id.in_(unique_storage_ids))).scalars().all()
        storage_map = {int(s.id): s for s in storages}

    out = []
    for r in rows:
        storage_id = int(r[14] or 0)
        storage_cfg = storage_map.get(storage_id)
        out.append(
            _build_file_item(
                {
                    "id": r[0],
                    "name": r[1],
                    "original_name": r[2],
                    "size": int(r[3]) if r[3] is not None else None,
                    "parent_path": r[4],
                    "path": r[5],
                    "extension": r[6],
                    "content_type": r[7],
                    "type": r[8],
                    "sha256": r[9],
                    "metadata": r[10],
                    "thumbnail_name": r[11],
                    "thumbnail_size": int(r[12]) if r[12] is not None else None,
                    "thumbnail_metadata": r[13],
                    "storage_id": storage_id,
                    "storage_name": r[15],
                    "create_time": r[16],
                    "create_user_string": r[17],
                    "update_time": r[18],
                    "update_user_string": r[19],
                },
                storage_cfg,
            )
        )
    return ok({"list": out, "total": total})


@router.post("/system/file/dir")
def create_dir(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err
    parent_path = normalize_parent_path(body.get("parentPath") or "/")
    original_name, err = require_non_empty_str(body.get("originalName"), "名称不能为空")
    if err is not None:
        return err
    return file_service.create_dir(
        db=db,
        user_id=int(user_id),
        parent_path=parent_path,
        original_name=original_name or "",
    )


@router.get("/system/file/dir/{id}/size")
def calc_dir_size(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    row = db.execute(select(SysFile.type, SysFile.path).where(SysFile.id == int(id)).limit(1)).first()
    if row is None:
        return fail("404", "文件夹不存在")
    if int(row[0] or 0) != 0:
        return fail("400", "ID 不是文件夹，无法计算大小")

    prefix = str(row[1] or "").rstrip("/") + "/%"
    total = db.execute(
        select(func.coalesce(func.sum(SysFile.size), 0)).where(SysFile.type != 0).where(SysFile.path.like(prefix))
    ).scalar_one()
    return ok({"size": int(total or 0)})


@router.get("/system/file/statistics")
def statistics(db: Session = Depends(get_db)):
    rows = db.execute(
        select(SysFile.type, func.count(1), func.coalesce(func.sum(SysFile.size), 0))
        .where(SysFile.type != 0)
        .group_by(SysFile.type)
    ).all()
    if not rows:
        return ok({})

    data = []
    total_size = 0
    total_number = 0
    for r in rows:
        item = {"type": int(r[0] or 0), "number": int(r[1] or 0), "size": int(r[2] or 0)}
        total_size += item["size"]
        total_number += item["number"]
        data.append(item)
    return ok({"size": total_size, "number": total_number, "data": data})


@router.get("/system/file/check")
def check_file(request: Request, db: Session = Depends(get_db)):
    h = (request.query_params.get("fileHash") or "").strip()
    if h == "":
        return ok(None)

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    st = aliased(SysStorage)
    row = db.execute(
        select(
            SysFile.id,
            SysFile.name,
            SysFile.original_name,
            SysFile.size,
            SysFile.parent_path,
            SysFile.path,
            func.coalesce(SysFile.extension, ""),
            func.coalesce(SysFile.content_type, ""),
            SysFile.type,
            func.coalesce(SysFile.sha256, ""),
            func.coalesce(SysFile.metadata_, ""),
            func.coalesce(SysFile.thumbnail_name, ""),
            SysFile.thumbnail_size,
            func.coalesce(SysFile.thumbnail_metadata, ""),
            SysFile.storage_id,
            func.coalesce(st.name, ""),
            SysFile.create_time,
            func.coalesce(cu.nickname, ""),
            SysFile.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysFile)
        .join(cu, cu.id == SysFile.create_user, isouter=True)
        .join(uu, uu.id == SysFile.update_user, isouter=True)
        .join(st, st.id == SysFile.storage_id, isouter=True)
        .where(SysFile.sha256 == h)
        .limit(1)
    ).first()
    if row is None:
        return ok(None)

    storage_cfg = None
    storage_id = int(row[14] or 0)
    if storage_id > 0:
        storage_cfg = db.execute(select(SysStorage).where(SysStorage.id == storage_id).limit(1)).scalar_one_or_none()

    item = _build_file_item(
        {
            "id": row[0],
            "name": row[1],
            "original_name": row[2],
            "size": int(row[3]) if row[3] is not None else None,
            "parent_path": row[4],
            "path": row[5],
            "extension": row[6],
            "content_type": row[7],
            "type": row[8],
            "sha256": row[9],
            "metadata": row[10],
            "thumbnail_name": row[11],
            "thumbnail_size": int(row[12]) if row[12] is not None else None,
            "thumbnail_metadata": row[13],
            "storage_id": storage_id,
            "storage_name": row[15],
            "create_time": row[16],
            "create_user_string": row[17],
            "update_time": row[18],
            "update_user_string": row[19],
        },
        storage_cfg,
    )
    return ok(item)


@router.put("/system/file/{id}")
def update_file(
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
    original_name, err = require_non_empty_str(body.get("originalName"), "名称不能为空")
    if err is not None:
        return err
    return file_service.rename_file(
        db=db,
        user_id=int(user_id),
        file_id=int(id),
        original_name=original_name or "",
    )


@router.delete("/system/file")
def delete_file(
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
    return file_service.delete_files(db=db, ids=ids)
