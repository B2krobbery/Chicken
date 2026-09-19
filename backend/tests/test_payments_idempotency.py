import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.order import Order

def test_payment_idempotency_and_webhook_handling(
    client: TestClient,
    db_session: Session,
    buyer1_token: str
):
    # Find a sample order
    order = db_session.query(Order).first()
    assert order is not None

    idemp_key = f"idemp_test_{uuid.uuid4().hex}"

    # 1. Create payment intent
    intent_res = client.post(
        "/api/v1/payments/intent",
        headers={
            "Authorization": f"Bearer {buyer1_token}",
            "Idempotency-Key": idemp_key
        },
        json={"order_id": str(order.id)}
    )
    assert intent_res.status_code == 200
    payment_id = intent_res.json()["payment_id"]

    # 2. Replay same intent request with same idempotency key -> Returns same payment
    intent_replay = client.post(
        "/api/v1/payments/intent",
        headers={
            "Authorization": f"Bearer {buyer1_token}",
            "Idempotency-Key": idemp_key
        },
        json={"order_id": str(order.id)}
    )
    assert intent_replay.status_code == 200
    assert intent_replay.json()["payment_id"] == payment_id

    # 3. Simulate gateway webhook for successful payment
    webhook_event_id = f"evt_{uuid.uuid4().hex}"
    webhook_payload = {
        "event_id": webhook_event_id,
        "payment_id": payment_id,
        "status": "SUCCESS",
        "transaction_id": f"txn_{uuid.uuid4().hex[:8]}"
    }

    wh_res1 = client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert wh_res1.status_code == 200

    # 4. Duplicate webhook replay (network retry) -> Must handle idempotently
    wh_res2 = client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert wh_res2.status_code == 200
    assert "already processed" in wh_res2.json()["message"]
