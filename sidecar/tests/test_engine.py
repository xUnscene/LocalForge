def test_engine_status_not_installed(client):
    response = client.get('/engine/status')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'not_installed'


def test_engine_start_returns_error_when_not_installed(client):
    response = client.post('/engine/start')
    assert response.status_code == 409
    data = response.json()
    assert 'not installed' in data['detail'].lower()


def test_engine_stop_is_safe_when_not_running(client):
    response = client.post('/engine/stop')
    assert response.status_code == 200


def test_engine_status_stopped_when_installed(client, engine_dir):
    import os
    os.makedirs(os.path.join(engine_dir, 'ComfyUI'), exist_ok=True)
    response = client.get('/engine/status')
    assert response.json()['status'] == 'stopped'


from unittest.mock import MagicMock, patch


def test_engine_status_running_when_process_active(client, engine_dir):
    import os
    os.makedirs(os.path.join(engine_dir, 'ComfyUI'), exist_ok=True)
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None  # process still running
    # Inject mock process into the app's manager singleton
    from fastapi.testclient import TestClient
    app = client.app
    app.state.manager._process = mock_proc
    response = client.get('/engine/status')
    assert response.json()['status'] == 'running'


def test_engine_status_error_when_process_crashed(client, engine_dir):
    import os
    os.makedirs(os.path.join(engine_dir, 'ComfyUI'), exist_ok=True)
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 1  # non-zero exit = crash
    app = client.app
    app.state.manager._process = mock_proc
    response = client.get('/engine/status')
    assert response.json()['status'] == 'error'


def test_engine_stop_returns_not_installed_when_not_installed(client):
    response = client.post('/engine/stop')
    assert response.status_code == 200
    # When not installed, manager.get_status() returns 'not_installed' after stop
    assert response.json()['status'] == 'not_installed'
