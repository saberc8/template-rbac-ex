from __future__ import annotations

from fastapi.testclient import TestClient


def test_menu_create_update_delete_smoke_with_frontend_isolation(client: TestClient) -> None:
    # create (react)
    r1 = client.post(
        "/system/menu",
        headers={"X-Admin-Frontend": "react"},
        json={"title": "m1", "parentId": 0, "type": 1, "path": "/m1", "name": "m1", "component": "m1/index"},
    )
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["success"] is True
    mid_react = j1["data"]["id"]
    assert isinstance(mid_react, str)
    assert int(mid_react) > 0

    # create child (react) to ensure recursive id stringify in /tree
    r1b = client.post(
        "/system/menu",
        headers={"X-Admin-Frontend": "react"},
        json={
            "title": "m1-1",
            "parentId": int(mid_react),
            "type": 1,
            "path": "/m1/child",
            "name": "m11",
            "component": "m1/child/index",
        },
    )
    assert r1b.status_code == 200
    j1b = r1b.json()
    assert j1b["success"] is True
    mid_react_child = j1b["data"]["id"]
    assert isinstance(mid_react_child, str)
    assert int(mid_react_child) > 0

    # create (vue3)
    r2 = client.post(
        "/system/menu",
        headers={"X-Admin-Frontend": "vue3"},
        json={"title": "m2", "parentId": 0, "type": 1, "path": "/m2", "name": "m2", "component": "m2/index"},
    )
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["success"] is True
    mid_vue3 = j2["data"]["id"]
    assert isinstance(mid_vue3, int)
    assert mid_vue3 > 0

    # update (react)
    r3 = client.put(
        f"/system/menu/{int(mid_react)}",
        headers={"X-Admin-Frontend": "react"},
        json={"title": "m1b", "parentId": 0, "type": 1, "path": "/m1", "name": "m1", "component": "m1/index"},
    )
    assert r3.status_code == 200
    assert r3.json()["success"] is True

    # tree (react) -> stringify ids
    r4 = client.get("/system/menu/tree", headers={"X-Admin-Frontend": "react"})
    assert r4.status_code == 200
    j4 = r4.json()
    assert j4["success"] is True
    roots_react = j4["data"]
    assert isinstance(roots_react, list)
    assert any(isinstance(n.get("id"), str) for n in roots_react)
    parent = [n for n in roots_react if str(n.get("id") or "") == str(mid_react)][0]
    child = [n for n in (parent.get("children") or []) if str(n.get("id") or "") == str(mid_react_child)][0]
    assert isinstance(child.get("id"), str)
    assert isinstance(child.get("parentId"), str)

    # delete only react dataset
    r5 = client.request(
        "DELETE",
        "/system/menu",
        headers={"X-Admin-Frontend": "react"},
        json={"ids": [int(mid_react)]},
    )
    assert r5.status_code == 200
    assert r5.json()["success"] is True

    r6 = client.get("/system/menu/tree", headers={"X-Admin-Frontend": "react"})
    assert r6.status_code == 200
    assert r6.json()["data"] == []

    # vue3 dataset still exists
    r7 = client.get("/system/menu/tree", headers={"X-Admin-Frontend": "vue3"})
    assert r7.status_code == 200
    j7 = r7.json()
    assert j7["success"] is True
    roots_vue3 = j7["data"]
    assert isinstance(roots_vue3, list)
    assert any(int(n.get("id") or 0) == int(mid_vue3) for n in roots_vue3)
