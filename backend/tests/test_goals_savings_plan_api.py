from datetime import date, timedelta

from httpx import AsyncClient


async def _register(client: AsyncClient, email: str, income: str) -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": email.split("@")[0],
            "email": email,
            "password": "senha123",
            "monthly_income": income,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_goal_without_target_date_has_no_savings_plan(client: AsyncClient):
    headers = await _register(client, "sem_data@example.com", "3000.00")

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Viagem", "target_amount": "1000.00"},
        headers=headers,
    )
    body = resp.json()

    assert body["monthly_amount_needed"] is None
    assert body["is_feasible"] is None


async def test_goal_with_target_date_computes_feasible_plan(client: AsyncClient):
    headers = await _register(client, "feasivel@example.com", "3000.00")
    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1000.00"},
        headers=headers,
    )
    target_date = (date.today() + timedelta(days=59)).isoformat()

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "2000.00", "target_date": target_date},
        headers=headers,
    )
    body = resp.json()

    assert float(body["disposable_income"]) == 2000.0
    assert body["is_feasible"] is True
    assert float(body["savings_shortfall"]) == 0.0


async def test_goal_with_target_date_computes_infeasible_plan(client: AsyncClient):
    headers = await _register(client, "inviavel@example.com", "1000.00")
    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "900.00"},
        headers=headers,
    )
    target_date = (date.today() + timedelta(days=20)).isoformat()

    resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "5000.00", "target_date": target_date},
        headers=headers,
    )
    body = resp.json()

    assert float(body["disposable_income"]) == 100.0
    assert body["is_feasible"] is False
    assert float(body["savings_shortfall"]) > 0


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


async def test_list_goals_includes_savings_plan_fields(client: AsyncClient):
    headers = await _register(client, "lista_metas@example.com", "3000.00")

    target_date = _add_months(date.today().replace(day=1), 3).isoformat()
    create_resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "1200.00", "target_date": target_date},
        headers=headers,
    )
    assert create_resp.status_code == 201

    list_resp = await client.get("/api/v1/goals", headers=headers)
    assert list_resp.status_code == 200
    body = list_resp.json()

    assert len(body) == 1
    goal = body[0]
    assert float(goal["monthly_amount_needed"]) == 400.00
    assert goal["months_remaining"] == 3
    assert goal["is_feasible"] is True


async def test_updating_fixed_expenses_changes_goal_plan_on_next_fetch(client: AsyncClient):
    headers = await _register(client, "atualiza@example.com", "2000.00")
    target_date = (date.today() + timedelta(days=30)).isoformat()
    create_resp = await client.post(
        "/api/v1/goals",
        json={"name": "Reserva", "target_amount": "2000.00", "target_date": target_date},
        headers=headers,
    )
    goal_id = create_resp.json()["id"]
    assert create_resp.json()["is_feasible"] is True

    await client.post(
        "/api/v1/fixed-expenses",
        json={"name": "Aluguel", "amount": "1900.00"},
        headers=headers,
    )

    refreshed = await client.get(f"/api/v1/goals/{goal_id}", headers=headers)
    assert refreshed.json()["is_feasible"] is False
