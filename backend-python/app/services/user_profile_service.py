"""用户个人中心用例编排（保持对外接口契约不变）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import Request, UploadFile
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_file import SysFile
from app.db.models.sys_storage import SysStorage
from app.db.models.sys_user import SysUser
from app.http.response import APIResponse, fail, ok
from app.http.routes import file_api
from app.http.utils import build_storage_file_url, detect_file_type, extension_from_filename, normalize_parent_path
from app.security.password import hash_password, verify_password
from app.security.password_policy import validate_password


def _absolute_url(request: Request, url: str) -> str:
    url = (url or "").strip()
    if url == "":
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return str(request.base_url).rstrip("/") + url
    return url


def _get_default_storage(db: Session) -> Optional[SysStorage]:
    return db.execute(select(SysStorage).where(SysStorage.is_default.is_(True)).limit(1)).scalar_one_or_none()


def upload_avatar(*, request: Request, db: Session, user_id: int, avatar_file: UploadFile) -> APIResponse:
    storage = _get_default_storage(db)
    if storage is None:
        return fail("500", "获取存储配置失败")

    parent_path_norm = normalize_parent_path("/avatar")
    ext = extension_from_filename(avatar_file.filename or "")
    file_id = next_id()
    if file_id <= 0:
        return fail("500", "保存文件失败")

    stored_name = f"{file_id}.{ext}" if ext else str(file_id)
    full_path = file_api._join_full_path(parent_path_norm, stored_name)

    try:
        if int(storage.type or 0) == 2:
            sha, size, content_type = file_api._put_to_minio(avatar_file, storage, full_path)
        else:
            sha, size, content_type = file_api._save_to_local(avatar_file, file_api._local_root_dir(storage), full_path)
    except Exception:
        return fail("500", "保存文件失败")

    now = datetime.now()
    ftype = detect_file_type(ext, content_type)
    try:
        db.add(
            SysFile(
                id=file_id,
                name=stored_name,
                original_name=avatar_file.filename or stored_name,
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


def _verify_old_password(db: Session, user_id: int, old_password: str) -> Optional[APIResponse]:
    old_password = (old_password or "").strip()
    if old_password == "":
        return fail("400", "请输入当前密码")
    user = db.execute(select(SysUser).where(SysUser.id == int(user_id)).limit(1)).scalar_one_or_none()
    if user is None:
        return fail("404", "用户不存在")
    encoded = str(user.password or "")
    if not verify_password(old_password, encoded):
        return fail("400", "当前密码不正确")
    return None


def update_basic_info(*, db: Session, user_id: int, nickname: str, gender: int) -> APIResponse:
    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(nickname=nickname, gender=gender, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改基本信息失败")
    return ok({})


def update_phone(*, db: Session, user_id: int, phone: str, old_password: str) -> APIResponse:
    verr = _verify_old_password(db, int(user_id), old_password)
    if verr is not None:
        return verr

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(phone=phone, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改手机号失败")
    return ok({})


def update_email(*, db: Session, user_id: int, email: str, old_password: str) -> APIResponse:
    verr = _verify_old_password(db, int(user_id), old_password)
    if verr is not None:
        return verr

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(email=email, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改邮箱失败")
    return ok({})


def update_password(*, db: Session, user_id: int, old_password: str, new_password_raw: str) -> APIResponse:
    verr = _verify_old_password(db, int(user_id), old_password)
    if verr is not None:
        return verr

    new_password, err = validate_password(new_password_raw)
    if err is not None:
        return err
    if (new_password or "") == old_password:
        return fail("400", "新密码与旧密码不能相同")

    try:
        encoded = hash_password(new_password or "")
    except Exception:
        return fail("500", "密码加密失败")

    now = datetime.now()
    try:
        db.execute(
            update(SysUser)
            .where(SysUser.id == int(user_id))
            .values(password=encoded, pwd_reset_time=now, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改密码失败")
    return ok({})
