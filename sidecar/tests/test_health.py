from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers.health import router


def make_test_app():
    app = FastAPI()
    app.include_router(router)
    return app


client = TestClient(make_test_app())


def test_health_returns_200():
    response = client.get('/health')
    assert response.status_code == 200


def test_health_returns_running_status():
    response = client.get('/health')
    data = response.json()
    assert data['status'] == 'running'
    assert data['version'] == '1.0.0'
