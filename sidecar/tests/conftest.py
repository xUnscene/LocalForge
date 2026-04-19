import os
import pytest
from fastapi.testclient import TestClient
from app import create_app


@pytest.fixture
def engine_dir(tmp_path) -> str:
    return str(tmp_path / 'engine')


@pytest.fixture
def client(engine_dir) -> TestClient:
    app = create_app(engine_dir=engine_dir)
    return TestClient(app)
