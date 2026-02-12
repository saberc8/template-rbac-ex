from __future__ import annotations

from fastapi.testclient import TestClient


def test_storage_write_routes_smoke(client: TestClient) -> None:
    # create
    resp = client.post(
        "/system/storage",
        json={
            "name": "s1",
            "code": "s1",
            "type": 1,
            "sort": 1,
            "status": 1,
            "bucketName": "./data/file",
            "isDefault": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    sid = int(body["data"]["id"])
    assert sid > 0

    # update
    resp2 = client.put(
        f"/system/storage/{sid}",
        json={
            "name": "s1b",
            "code": "s1",
            "type": 1,
            "sort": 2,
            "status": 1,
            "bucketName": "./data/file",
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True

    # update status
    resp3 = client.put(f"/system/storage/{sid}/status", json={"status": 2})
    assert resp3.status_code == 200
    assert resp3.json()["success"] is True

    # set default
    resp4 = client.put(f"/system/storage/{sid}/default")
    assert resp4.status_code == 200
    assert resp4.json()["success"] is True

    # delete should fail (default storage protected)
    resp5 = client.request("DELETE", "/system/storage", json={"ids": [sid]})
    assert resp5.status_code == 200
    j5 = resp5.json()
    assert j5["success"] is False
    assert j5["code"] == "400"
