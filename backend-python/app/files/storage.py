"""文件存储底座：本地/MinIO 的保存与删除能力。"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import BinaryIO, Optional, cast
from urllib.parse import urlparse

from fastapi import UploadFile

from app.db.models.sys_storage import SysStorage


def local_root_dir(storage: Optional[SysStorage]) -> str:
    if storage is not None and str(storage.bucket_name or "").strip():
        return str(storage.bucket_name).strip()
    v = (os.getenv("FILE_STORAGE_DIR") or "").strip()
    if v:
        return v
    return "./data/file"


def join_full_path(parent_path: str, stored_name: str) -> str:
    if parent_path == "/":
        return "/" + stored_name
    return parent_path + "/" + stored_name


def save_to_local(upload: UploadFile, root_dir: str, full_path: str) -> tuple[str, int, str]:
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
    def __init__(self, fp: BinaryIO, hasher):
        self._fp: BinaryIO = fp
        self._hasher = hasher

    def read(self, n: int = -1) -> bytes:
        data = cast(bytes, self._fp.read(n))
        if data:
            self._hasher.update(data)
        return data


def put_to_minio(upload: UploadFile, storage: SysStorage, full_path: str) -> tuple[str, int, str]:
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
    root_dir = local_root_dir(storage)
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


def delete_physical(storage: Optional[SysStorage], full_path: str) -> None:
    if storage is not None and int(storage.type or 0) == 2:
        _delete_from_minio(storage, full_path)
        return
    _delete_from_local(storage, full_path)
