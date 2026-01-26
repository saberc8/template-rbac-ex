"""用户个人中心接口：/user/profile/*（对齐前端调用）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_file import SysFile
from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.routes import file_api
from app.http.utils import build_storage_file_url, detect_file_type, extension_from_filename, normalize_parent_path


router = APIRouter()


def _absolute_url(request: Request, url: str) -> str:
    url = (url or "").strip()
    if url == "":
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return str(request.base_url).rstrip("/") + url
    return url


@router.patch("/user/profile/avatar")
def upload_avatar(
    request: Request,
    avatarFile: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if avatarFile is None:
        return fail("400", "文件不能为空")

    storage = db.execute(select(SysStorage).where(SysStorage.is_default.is_(True)).limit(1)).scalar_one_or_none()
    if storage is None:
        return fail("500", "获取存储配置失败")

    parent_path_norm = normalize_parent_path("/avatar")
    ext = extension_from_filename(avatarFile.filename or "")
    file_id = next_id()
    if file_id <= 0:
        return fail("500", "保存文件失败")

    stored_name = f"{file_id}.{ext}" if ext else str(file_id)
    full_path = file_api._join_full_path(parent_path_norm, stored_name)

    try:
        if int(storage.type or 0) == 2:
            sha, size, content_type = file_api._put_to_minio(avatarFile, storage, full_path)
        else:
            sha, size, content_type = file_api._save_to_local(avatarFile, file_api._local_root_dir(storage), full_path)
    except Exception:
        return fail("500", "保存文件失败")

    now = datetime.now()
    ftype = detect_file_type(ext, content_type)
    try:
        db.add(
            SysFile(
                id=file_id,
                name=stored_name,
                original_name=avatarFile.filename or stored_name,
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

        rel_url = build_storage_file_url(storage, full_path)
        avatar_url = _absolute_url(request, rel_url)

        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(avatar=avatar_url, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        file_api._delete_physical(storage, full_path)
        return fail("500", "更新头像失败")

    return ok({"avatar": avatar_url})

