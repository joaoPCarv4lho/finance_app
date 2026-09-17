from httpx import AsyncClient


async def test_create_list_update_delete_fixed_expense(
    client: AsyncClient, auth_headers: dict[str, str]
):
    create_resp = await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1200.00"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "Aluguel"
    assert float(created["amount"]) == 1200.0

    list_resp = await client.get("/api/v1/fixed-expenses", headers=auth_headers)
    assert list_resp.status_code == 200
    assert [item["name"] for item in list_resp.json()] == ["Aluguel"]

    update_resp = await client.patch(
        f"/api/v1/fixed-expenses/{created['id']}",
        json={"amount": "1300.00"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert float(update_resp.json()["amount"]) == 1300.0

    delete_resp = await client.delete(
        f"/api/v1/fixed-expenses/{created['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204

    final_list = await client.get("/api/v1/fixed-expenses", headers=auth_headers)
    assert final_list.json() == []


async def test_cannot_modify_another_users_fixed_expense(client: AsyncClient):
    resp_a = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "userA",
            "email": "usera@example.com",
            "password": "senha123",
            "monthly_income": "3000.00",
        },
    )
    token_a = resp_a.json()["access_token"]
    create_resp = await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1000.00"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    expense_id = create_resp.json()["id"]

    resp_b = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "userB",
            "email": "userb@example.com",
            "password": "senha123",
            "monthly_income": "2000.00",
        },
    )
    token_b = resp_b.json()["access_token"]

    patch_resp = await client.patch(
        f"/api/v1/fixed-expenses/{expense_id}",
        json={"amount": "1.00"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_resp.status_code == 404
