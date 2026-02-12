from __future__ import annotations

from fastapi.testclient import TestClient


def test_dict_item_route_not_shadowed_by_dict_id_route(client: TestClient) -> None:
    resp = client.get(
        "/system/dict/item",
        params={"dictId": 4, "page": 1, "size": 10, "sort": "createTime,desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "200"
    assert data["success"] is True
    assert "data" in data
    assert isinstance(data["data"], dict)
    assert "list" in data["data"]
    assert "total" in data["data"]
