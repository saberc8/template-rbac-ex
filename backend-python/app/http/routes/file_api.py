"""文件管理接口：/system/file/* 与 /common/file（对齐 backend-go/internal/interfaces/http/file_handler.go）。"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, File, Form, Request, UploadFile
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_file import SysFile
from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import (
    build_storage_file_url,
    detect_file_type,
    extension_from_filename,
    format_time,
    normalize_parent_path,
)

router = APIRouter()


def _local_root_dir(storage: Optional[SysStorage]) -> str:
    if storage is not None and str(storage.bucket_name or "").strip():
        return str(storage.bucket_name).strip()
    v = (os.getenv("FILE_STORAGE_DIR") or "").strip()
    if v:
        return v
    return "./data/file"


def _join_full_path(parent_path: str, stored_name: str) -> str:
    if parent_path == "/":
        return "/" + stored_name
    return parent_path + "/" + stored_name


def _save_to_local(upload: UploadFile, root_dir: str, full_path: str) -> tuple[str, int, str]:
    relative = full_path.lstrip("/")
    dst = Path(root_dir) / Path(relative)
    dst.parent.mkdir(parents=True, exist_ok=True)

    h = hashlib.sha256()
    size = 0
    content_type = (upload.content_type or "").strip()

    upload.file.seek(0)
    with dst.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            h.update(chunk)
            size += len(chunk)
    return h.hexdigest(), size, content_type


def _minio_client(storage: SysStorage):
    from minio import Minio

    endpoint = str(storage.endpoint or "").strip()
    access_key = str(storage.access_key or "").strip()
    secret_key = str(storage.secret_key or "").strip()
    if endpoint == "" or access_key == "" or secret_key == "":
        raise ValueError("对象存储配置不完整")

    secure = False
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        u = urlparse(endpoint)
        secure = u.scheme == "https"
        endpoint = u.netloc

    region = str(storage.region or "").strip() or None
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure, region=region)


class _HashingReader:
    def __init__(self, fp, hasher):
        self._fp = fp
        self._hasher = hasher

    def read(self, n: int = -1) -> bytes:
        b = self._fp.read(n)
        if b:
            self._hasher.update(b)
        return b


def _put_to_minio(upload: UploadFile, storage: SysStorage, full_path: str) -> tuple[str, int, str]:
    client = _minio_client(storage)
    bucket = str(storage.bucket_name or "").strip()
    if bucket == "":
        raise ValueError("对象存储配置不完整")

    content_type = (upload.content_type or "").strip()
    object_name = full_path.lstrip("/")

    upload.file.seek(0, os.SEEK_END)
    size = int(upload.file.tell() or 0)
    upload.file.seek(0)

    if not client.bucket_exists(bucket):
        region = str(storage.region or "").strip()
        if region:
            client.make_bucket(bucket, location=region)
        else:
            client.make_bucket(bucket)

    h = hashlib.sha256()
    reader = _HashingReader(upload.file, h)
    client.put_object(bucket, object_name, reader, length=size, content_type=content_type or None)

    return h.hexdigest(), size, content_type


def _delete_from_local(storage: Optional[SysStorage], full_path: str) -> None:
    full_path = (full_path or "").strip()
    if full_path == "":
        return
    root_dir = _local_root_dir(storage)
    relative = full_path.lstrip("/")
    abs_path = Path(root_dir) / Path(relative)
    import contextlib

    with contextlib.suppress(Exception):
        abs_path.unlink()


def _delete_from_minio(storage: SysStorage, full_path: str) -> None:
    full_path = (full_path or "").strip()
    if full_path == "":
        return
    try:
        client = _minio_client(storage)
        bucket = str(storage.bucket_name or "").strip()
        if bucket:
            client.remove_object(bucket, full_path.lstrip("/"))
    except Exception:
        pass


def _delete_physical(storage: Optional[SysStorage], full_path: str) -> None:
    if storage is not None and int(storage.type or 0) == 2:
        _delete_from_minio(storage, full_path)
        return
    _delete_from_local(storage, full_path)


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

    parent_path_norm = normalize_parent_path(parentPath or "/")
    storage = _get_default_storage(db)
    if storage is None:
        return fail("500", "获取存储配置失败")

    ext = extension_from_filename(file.filename or "")
    file_id = next_id()
    if file_id <= 0:
        return fail("500", "生成文件 ID 失败")
    stored_name = f"{file_id}.{ext}" if ext else str(file_id)
    full_path = _join_full_path(parent_path_norm, stored_name)

    try:
        if int(storage.type or 0) == 2:
            sha, size, content_type = _put_to_minio(file, storage, full_path)
        else:
            sha, size, content_type = _save_to_local(file, _local_root_dir(storage), full_path)
    except Exception:
        return fail("500", "保存文件失败")

    now = datetime.now()
    ftype = detect_file_type(ext, content_type)
    try:
        db.add(
            SysFile(
                id=file_id,
                name=stored_name,
                original_name=file.filename or stored_name,
                size=size,
                parent_path=parent_path_norm,
                path=full_path,
                extension=ext,
                content_type=content_type,
                type=ftype,
                sha256=sha,
                metadata_="",
                thumbnail_name="",
                thumbnail_size=None,
                thumbnail_metadata="",
                storage_id=int(storage.id),
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        _delete_physical(storage, full_path)
        return fail("500", "保存文件记录失败")

    url = build_storage_file_url(storage, full_path)
    return ok({"id": str(file_id), "url": url, "thUrl": url, "metadata": {}})


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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    parent_path = normalize_parent_path(body.get("parentPath") or "/")
    original_name = str(body.get("originalName") or "").strip()
    if original_name == "":
        return fail("400", "名称不能为空")

    exists = db.execute(
        select(SysFile.id)
        .where(SysFile.parent_path == parent_path)
        .where(SysFile.name == original_name)
        .where(SysFile.type == 0)
        .limit(1)
    ).first()
    if exists is not None:
        return fail("400", "文件夹已存在")

    storage = _get_default_storage(db)
    if storage is None:
        return fail("500", "获取存储配置失败")

    did = next_id()
    if did <= 0:
        return fail("500", "生成文件 ID 失败")

    path = _join_full_path(parent_path, original_name)
    now = datetime.now()
    try:
        db.add(
            SysFile(
                id=did,
                name=original_name,
                original_name=original_name,
                size=None,
                parent_path=parent_path,
                path=path,
                extension=None,
                content_type=None,
                type=0,
                sha256="",
                metadata_="",
                thumbnail_name="",
                thumbnail_size=None,
                thumbnail_metadata="",
                storage_id=int(storage.id),
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "创建文件夹失败")
    return ok(True)


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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    original_name = str(body.get("originalName") or "").strip()
    if original_name == "":
        return fail("400", "名称不能为空")

    now = datetime.now()
    try:
        db.execute(
            update(SysFile)
            .where(SysFile.id == int(id))
            .values(original_name=original_name, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "重命名失败")
    return ok(True)


@router.delete("/system/file")
def delete_file(
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

    targets: list[tuple[str, int]] = []
    for fid in ids:
        row = db.execute(
            select(SysFile.id, SysFile.name, SysFile.path, SysFile.type, SysFile.storage_id).where(SysFile.id == fid)
        ).first()
        if row is None:
            continue
        file_type = int(row[3] or 0)
        name = str(row[1] or "")
        path = str(row[2] or "")
        storage_id = int(row[4] or 0)

        if file_type == 0:
            child = db.execute(select(SysFile.id).where(SysFile.parent_path == path).limit(1)).first()
            if child is not None:
                return fail("400", f"文件夹 [{name}] 不为空，请先删除文件夹下的内容")
            continue
        targets.append((path, storage_id))

    try:
        db.execute(delete(SysFile).where(SysFile.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除文件失败")

    storage_ids = sorted({sid for _, sid in targets if sid > 0})
    storage_map: dict[int, SysStorage] = {}
    if storage_ids:
        storages = db.execute(select(SysStorage).where(SysStorage.id.in_(storage_ids))).scalars().all()
        storage_map = {int(s.id): s for s in storages}

    for path, sid in targets:
        storage_cfg = storage_map.get(sid)
        _delete_physical(storage_cfg, path)

    return ok(True)
