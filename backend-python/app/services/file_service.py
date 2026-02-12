"""文件管理用例编排（file_api 写接口）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_file import SysFile
from app.db.models.sys_storage import SysStorage
from app.files.storage import delete_physical, join_full_path, local_root_dir, put_to_minio, save_to_local
from app.http.response import APIResponse, fail, ok
from app.http.utils import build_storage_file_url, detect_file_type, extension_from_filename, normalize_parent_path


def _get_default_storage(db: Session) -> Optional[SysStorage]:
    return db.execute(select(SysStorage).where(SysStorage.is_default.is_(True)).limit(1)).scalar_one_or_none()


def upload_file(*, db: Session, user_id: int, file: UploadFile, parent_path: str) -> APIResponse:
    parent_path_norm = normalize_parent_path(parent_path or "/")
    storage = _get_default_storage(db)
    if storage is None:
        return fail("500", "获取存储配置失败")

    ext = extension_from_filename(file.filename or "")
    file_id = next_id()
    if file_id <= 0:
        return fail("500", "生成文件 ID 失败")
    stored_name = f"{file_id}.{ext}" if ext else str(file_id)
    full_path = join_full_path(parent_path_norm, stored_name)

    try:
        if int(storage.type or 0) == 2:
            sha, size, content_type = put_to_minio(file, storage, full_path)
        else:
            sha, size, content_type = save_to_local(file, local_root_dir(storage), full_path)
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
        delete_physical(storage, full_path)
        return fail("500", "保存文件记录失败")

    url = build_storage_file_url(storage, full_path)
    return ok({"id": str(file_id), "url": url, "thUrl": url, "metadata": {}})


def create_dir(*, db: Session, user_id: int, parent_path: str, original_name: str) -> APIResponse:
    parent_path_norm = normalize_parent_path(parent_path or "/")
    original_name = str(original_name or "").strip()
    if original_name == "":
        return fail("400", "名称不能为空")

    exists = db.execute(
        select(SysFile.id)
        .where(SysFile.parent_path == parent_path_norm)
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

    path = join_full_path(parent_path_norm, original_name)
    now = datetime.now()
    try:
        db.add(
            SysFile(
                id=did,
                name=original_name,
                original_name=original_name,
                size=None,
                parent_path=parent_path_norm,
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


def rename_file(*, db: Session, user_id: int, file_id: int, original_name: str) -> APIResponse:
    if file_id <= 0:
        return fail("400", "ID 参数不正确")
    original_name = str(original_name or "").strip()
    if original_name == "":
        return fail("400", "名称不能为空")

    now = datetime.now()
    try:
        db.execute(
            update(SysFile)
            .where(SysFile.id == int(file_id))
            .values(original_name=original_name, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "重命名失败")
    return ok(True)


def delete_files(*, db: Session, ids: list[int]) -> APIResponse:
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
        delete_physical(storage_cfg, path)

    return ok(True)
