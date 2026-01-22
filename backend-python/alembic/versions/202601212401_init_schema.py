"""init schema + seed (SSOT: backend-go/internal/infrastructure/db/migrate.go)

Revision ID: 202601212401
Revises:
Create Date: 2026-01-21 23:01:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.db.seed import seed_from_go_migrate


revision = "202601212401"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sys_user",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("nickname", sa.String(length=30), nullable=False),
        sa.Column("password", sa.String(length=255)),
        sa.Column("gender", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("email", sa.String(length=255)),
        sa.Column("phone", sa.String(length=255)),
        sa.Column("avatar", sa.Text()),
        sa.Column("description", sa.String(length=200)),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("pwd_reset_time", sa.DateTime()),
        sa.Column("dept_id", sa.BigInteger(), nullable=False),
        sa.Column("create_user", sa.BigInteger()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_user_username", "sys_user", ["username"], unique=True)
    op.create_index("uk_user_email", "sys_user", ["email"], unique=True)
    op.create_index("uk_user_phone", "sys_user", ["phone"], unique=True)
    op.create_index("idx_user_dept_id", "sys_user", ["dept_id"])
    op.create_index("idx_user_create_user", "sys_user", ["create_user"])
    op.create_index("idx_user_update_user", "sys_user", ["update_user"])

    op.create_table(
        "sys_role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(length=30), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("data_scope", sa.SmallInteger(), nullable=False, server_default=sa.text("4")),
        sa.Column("description", sa.String(length=200)),
        sa.Column("sort", sa.Integer(), nullable=False, server_default=sa.text("999")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("menu_check_strictly", sa.Boolean(), server_default=sa.text("TRUE")),
        sa.Column("dept_check_strictly", sa.Boolean(), server_default=sa.text("TRUE")),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_role_name", "sys_role", ["name"], unique=True)
    op.create_index("uk_role_code", "sys_role", ["code"], unique=True)
    op.create_index("idx_role_create_user", "sys_role", ["create_user"])
    op.create_index("idx_role_update_user", "sys_role", ["update_user"])

    op.create_table(
        "sys_user_role",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
    )
    op.create_index("uk_user_id_role_id", "sys_user_role", ["user_id", "role_id"], unique=True)

    op.create_table(
        "sys_menu",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("title", sa.String(length=30), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("type", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("path", sa.String(length=255)),
        sa.Column("name", sa.String(length=50)),
        sa.Column("component", sa.String(length=255)),
        sa.Column("redirect", sa.String(length=255)),
        sa.Column("icon", sa.String(length=50)),
        sa.Column("is_external", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("is_cache", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("permission", sa.String(length=100)),
        sa.Column("sort", sa.Integer(), nullable=False, server_default=sa.text("999")),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("idx_menu_parent_id", "sys_menu", ["parent_id"])
    op.create_index("idx_menu_create_user", "sys_menu", ["create_user"])
    op.create_index("idx_menu_update_user", "sys_menu", ["update_user"])
    op.create_index("uk_menu_title_parent_id", "sys_menu", ["title", "parent_id"], unique=True)

    op.create_table(
        "sys_file",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("size", sa.BigInteger()),
        sa.Column("parent_path", sa.String(length=512), nullable=False, server_default=sa.text(\"'/'\")),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("extension", sa.String(length=100)),
        sa.Column("content_type", sa.String(length=255)),
        sa.Column("type", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("sha256", sa.String(length=256), nullable=False),
        sa.Column("metadata", sa.Text()),
        sa.Column("thumbnail_name", sa.String(length=255)),
        sa.Column("thumbnail_size", sa.BigInteger()),
        sa.Column("thumbnail_metadata", sa.Text()),
        sa.Column("storage_id", sa.BigInteger(), nullable=False),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("idx_file_type", "sys_file", ["type"])
    op.create_index("idx_file_sha256", "sys_file", ["sha256"])
    op.create_index("idx_file_storage_id", "sys_file", ["storage_id"])
    op.create_index("idx_file_create_user", "sys_file", ["create_user"])

    op.create_table(
        "sys_option",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text()),
        sa.Column("default_value", sa.Text()),
        sa.Column("description", sa.String(length=200)),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_option_category_code", "sys_option", ["category", "code"], unique=True)

    op.create_table(
        "sys_storage",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("type", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("access_key", sa.String(length=255)),
        sa.Column("secret_key", sa.String(length=255)),
        sa.Column("endpoint", sa.String(length=255)),
        sa.Column("region", sa.String(length=100)),
        sa.Column("bucket_name", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255)),
        sa.Column("description", sa.String(length=200)),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("sort", sa.Integer(), nullable=False, server_default=sa.text("999")),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_storage_code", "sys_storage", ["code"], unique=True)
    op.create_index("idx_storage_create_user", "sys_storage", ["create_user"])
    op.create_index("idx_storage_update_user", "sys_storage", ["update_user"])

    op.create_table(
        "sys_client",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("client_id", sa.String(length=50), nullable=False),
        sa.Column("client_type", sa.String(length=50), nullable=False),
        sa.Column("auth_type", sa.JSON(), nullable=False),
        sa.Column("active_timeout", sa.BigInteger(), nullable=False, server_default=sa.text("-1")),
        sa.Column("timeout", sa.BigInteger(), nullable=False, server_default=sa.text("2592000")),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_client_client_id", "sys_client", ["client_id"], unique=True)
    op.create_index("idx_client_create_user", "sys_client", ["create_user"])
    op.create_index("idx_client_update_user", "sys_client", ["update_user"])

    op.create_table(
        "sys_role_menu",
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("menu_id", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("role_id", "menu_id"),
    )

    op.create_table(
        "sys_role_dept",
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("dept_id", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("role_id", "dept_id"),
    )
    op.create_index("idx_role_dept_role_id", "sys_role_dept", ["role_id"])
    op.create_index("idx_role_dept_dept_id", "sys_role_dept", ["dept_id"])

    op.create_table(
        "sys_dept",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(length=30), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("sort", sa.Integer(), nullable=False, server_default=sa.text("999")),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("description", sa.String(length=200)),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("idx_dept_parent_id", "sys_dept", ["parent_id"])
    op.create_index("idx_dept_create_user", "sys_dept", ["create_user"])
    op.create_index("idx_dept_update_user", "sys_dept", ["update_user"])

    op.create_table(
        "sys_dict",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("name", sa.String(length=30), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("description", sa.String(length=200)),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("uk_dict_code", "sys_dict", ["code"], unique=True)
    op.create_index("idx_dict_create_user", "sys_dict", ["create_user"])
    op.create_index("idx_dict_update_user", "sys_dict", ["update_user"])

    op.create_table(
        "sys_dict_item",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("label", sa.String(length=30), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=30)),
        sa.Column("sort", sa.Integer(), nullable=False, server_default=sa.text("999")),
        sa.Column("description", sa.String(length=200)),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("dict_id", sa.BigInteger(), nullable=False),
        sa.Column("create_user", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_user", sa.BigInteger()),
        sa.Column("update_time", sa.DateTime()),
    )
    op.create_index("idx_dict_item_dict_id", "sys_dict_item", ["dict_id"])
    op.create_index("idx_dict_item_create_user", "sys_dict_item", ["create_user"])
    op.create_index("idx_dict_item_update_user", "sys_dict_item", ["update_user"])

    op.create_table(
        "sys_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("trace_id", sa.String(length=255)),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("module", sa.String(length=100), nullable=False),
        sa.Column("request_url", sa.String(length=512), nullable=False),
        sa.Column("request_method", sa.String(length=10), nullable=False),
        sa.Column("request_headers", sa.Text()),
        sa.Column("request_body", sa.Text()),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_headers", sa.Text()),
        sa.Column("response_body", sa.Text()),
        sa.Column("time_taken", sa.BigInteger(), nullable=False),
        sa.Column("ip", sa.String(length=100)),
        sa.Column("address", sa.String(length=255)),
        sa.Column("browser", sa.String(length=100)),
        sa.Column("os", sa.String(length=100)),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("error_msg", sa.Text()),
        sa.Column("create_user", sa.BigInteger()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_log_module", "sys_log", ["module"])
    op.create_index("idx_log_ip", "sys_log", ["ip"])
    op.create_index("idx_log_address", "sys_log", ["address"])
    op.create_index("idx_log_create_time", "sys_log", ["create_time"])

    bind = op.get_bind()
    seed_from_go_migrate(bind)


def downgrade() -> None:
    op.drop_table("sys_log")
    op.drop_table("sys_dict_item")
    op.drop_table("sys_dict")
    op.drop_table("sys_dept")
    op.drop_table("sys_role_dept")
    op.drop_table("sys_role_menu")
    op.drop_table("sys_client")
    op.drop_table("sys_storage")
    op.drop_table("sys_option")
    op.drop_table("sys_file")
    op.drop_table("sys_menu")
    op.drop_table("sys_user_role")
    op.drop_table("sys_role")
    op.drop_table("sys_user")
