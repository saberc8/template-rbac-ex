package auth

import (
	"context"
	"testing"
	"time"

	domainrbac "go-backend/internal/domain/rbac"
	domainuser "go-backend/internal/domain/user"
)

type stubRoleRepo struct {
	roles []domainrbac.Role
	err   error
}

func (s stubRoleRepo) ListByUserID(ctx context.Context, userID int64) ([]domainrbac.Role, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.roles, nil
}

func (s stubRoleRepo) ListCodesByUserID(ctx context.Context, userID int64) ([]string, error) {
	out := make([]string, 0, len(s.roles))
	for _, r := range s.roles {
		out = append(out, r.Code)
	}
	return out, nil
}

type stubMenuRepo struct {
	perms []string
	byRID map[int64][]domainrbac.Menu
	err   error
}

func (s stubMenuRepo) ListByRoleID(ctx context.Context, roleID int64) ([]domainrbac.Menu, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.byRID[roleID], nil
}

func (s stubMenuRepo) ListPermissionsByUserID(ctx context.Context, userID int64) ([]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.perms, nil
}

func TestUserQueryService_GetUserInfo_OK(t *testing.T) {
	now := time.Now()
	u := &domainuser.User{ID: 1, Username: "u", Nickname: "n", Status: 1, CreateTime: now}
	users := stubUserRepo{byID: map[int64]*domainuser.User{1: u}}
	roles := stubRoleRepo{roles: []domainrbac.Role{{ID: 10, Code: "ADMIN"}}}
	menus := stubMenuRepo{perms: []string{"p1"}}

	svc := NewUserQueryService(users, roles, menus)
	info, derr := svc.GetUserInfo(context.Background(), 1)
	if derr != nil {
		t.Fatalf("expected nil error, got %+v", derr)
	}
	if info.ID != 1 || len(info.Roles) != 1 || info.Roles[0] != "ADMIN" || len(info.Permissions) != 1 || info.Permissions[0] != "p1" {
		t.Fatalf("unexpected info: %+v", info)
	}
}

func TestUserQueryService_ListUserRoute_FiltersButton(t *testing.T) {
	users := stubUserRepo{}
	roles := stubRoleRepo{roles: []domainrbac.Role{{ID: 10, Code: "ADMIN"}}}
	menus := stubMenuRepo{
		byRID: map[int64][]domainrbac.Menu{
			10: {
				{ID: 1, ParentID: 0, Title: "Root", Type: domainrbac.MenuTypeDir, Path: "/"},
				{ID: 2, ParentID: 1, Title: "Child", Type: domainrbac.MenuTypeMenu, Path: "/c"},
				{ID: 3, ParentID: 1, Title: "Btn", Type: domainrbac.MenuTypeButton, Permission: "p"},
			},
		},
	}

	svc := NewUserQueryService(users, roles, menus)
	route, derr := svc.ListUserRoute(context.Background(), 1)
	if derr != nil {
		t.Fatalf("expected nil error, got %+v", derr)
	}
	if len(route) == 0 {
		t.Fatalf("expected non-empty route")
	}
	// Ensure button-type menu is not included.
	var hasButton bool
	var walk func(items []RouteItem)
	walk = func(items []RouteItem) {
		for _, it := range items {
			if it.ID == 3 {
				hasButton = true
			}
			if len(it.Children) > 0 {
				walk(it.Children)
			}
		}
	}
	walk(route)
	if hasButton {
		t.Fatalf("expected button menu to be filtered out")
	}
}
