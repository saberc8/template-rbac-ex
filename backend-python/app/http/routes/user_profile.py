"""用户个人中心接口：/user/profile/*（对齐前端调用）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session

from app.http.deps import get_db, require_user_id
from app.http.response import fail
from app.http.validators import parse_int, require_dict_body, require_non_empty_str
from app.services import user_profile_service

router = APIRouter()


@router.patch("/user/profile/avatar")
def upload_avatar(
    request: Request,
    avatarFile: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if avatarFile is None:
        return fail("400", "文件不能为空")
    return user_profile_service.upload_avatar(request=request, db=db, user_id=int(user_id), avatar_file=avatarFile)


@router.put("/user/profile/basic/info")
def update_basic_info(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    nickname, err = require_non_empty_str(body.get("nickname"), "昵称不能为空")
    if err is not None:
        return err
    gender, err = parse_int(body.get("gender"), "性别参数不正确", default=0, min_value=0)
    if err is not None:
        return err

    return user_profile_service.update_basic_info(
        db=db, user_id=int(user_id), nickname=nickname or "", gender=int(gender or 0)
    )


@router.put("/user/profile/phone")
def update_phone(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    phone, err = require_non_empty_str(body.get("phone"), "请输入手机号")
    if err is not None:
        return err

    old_password, err = require_non_empty_str(body.get("oldPassword"), "请输入当前密码")
    if err is not None:
        return err

    return user_profile_service.update_phone(
        db=db,
        user_id=int(user_id),
        phone=phone or "",
        old_password=old_password or "",
    )


@router.put("/user/profile/email")
def update_email(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    email, err = require_non_empty_str(body.get("email"), "请输入邮箱")
    if err is not None:
        return err
    if "@" not in email:
        return fail("400", "请输入正确的邮箱")

    old_password, err = require_non_empty_str(body.get("oldPassword"), "请输入当前密码")
    if err is not None:
        return err

    return user_profile_service.update_email(
        db=db,
        user_id=int(user_id),
        email=email or "",
        old_password=old_password or "",
    )


@router.put("/user/profile/password")
def update_password(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    old_password, err = require_non_empty_str(body.get("oldPassword"), "请输入当前密码")
    if err is not None:
        return err
    new_password_raw = str(body.get("newPassword") or "")

    return user_profile_service.update_password(
        db=db,
        user_id=int(user_id),
        old_password=old_password or "",
        new_password_raw=new_password_raw,
    )
