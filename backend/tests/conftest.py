import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client

@pytest.fixture
def mock_db_session(mocker):
    # This is a sample fixture for mocking database sessions
    session = mocker.MagicMock()
    return session
