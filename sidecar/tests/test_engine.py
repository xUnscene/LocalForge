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
