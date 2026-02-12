from __future__ import annotations

from fastapi.testclient import TestClient


def test_dict_and_item_write_routes_smoke(client: TestClient) -> None:
    # create dict
    r1 = client.post("/system/dict", json={"name": "n1", "code": "c1", "description": "d"})
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["success"] is True
    did = int(j1["data"]["id"])
    assert did > 0

    # update dict
    r2 = client.put(f"/system/dict/{did}", json={"name": "n2", "description": "d2"})
    assert r2.status_code == 200
    assert r2.json()["success"] is True

    # create item
    r3 = client.post(
        "/system/dict/item",
        json={"label": "l1", "value": "v1", "dictId": did, "sort": 1, "status": 1},
    )
    assert r3.status_code == 200
    j3 = r3.json()
    assert j3["success"] is True
    iid = int(j3["data"]["id"])
    assert iid > 0

    # update item
    r4 = client.put(
        f"/system/dict/item/{iid}",
        json={"label": "l2", "value": "v2", "color": "primary", "sort": 2, "status": 1},
    )
    assert r4.status_code == 200
    assert r4.json()["success"] is True

    # delete item
    r5 = client.request("DELETE", "/system/dict/item", json={"ids": [iid]})
    assert r5.status_code == 200
    assert r5.json()["success"] is True

    # delete dict
    r6 = client.request("DELETE", "/system/dict", json={"ids": [did]})
    assert r6.status_code == 200
    assert r6.json()["success"] is True
