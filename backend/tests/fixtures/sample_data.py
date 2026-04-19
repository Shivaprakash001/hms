import pytest

@pytest.fixture
def sample_tenant_data():
    return {
        "id": "tenant-123",
        "name": "Jane Doe",
        "email": "jane@example.com"
    }

@pytest.fixture
def sample_payment_data():
    return {
        "amount": 5000,
        "status": "completed",
        "reference": "pay_123xyz"
    }
