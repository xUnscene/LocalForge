import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app import create_app
from services.model_manager import ModelProgress


def test_get_models_returns_list(engine_dir):
    app = create_app(engine_dir=engine_dir)
    client = TestClient(app)
    r = client.get('/models')
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['id'] == 'z-image'
    assert 'installed' in data[0]
    assert 'badge' in data[0]


def test_install_returns_sse_stream(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_manager = MagicMock()
    mock_manager.start_install.return_value = None
    mock_manager.get_progress.return_value = ModelProgress(status='complete', percent=100)
    app.state.model_manager = mock_manager

    client = TestClient(app)
    with client.stream('POST', '/models/z-image/install') as r:
        assert r.status_code == 200
        assert 'text/event-stream' in r.headers['content-type']
        r.read()
        content = r.text

    assert 'complete' in content
    mock_manager.start_install.assert_called_once_with('z-image')


def test_install_returns_error_sse_when_model_unknown(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_manager = MagicMock()
    mock_manager.start_install.return_value = 'Unknown model: bad-model'
    app.state.model_manager = mock_manager

    client = TestClient(app)
    with client.stream('POST', '/models/bad-model/install') as r:
        assert r.status_code == 200
        assert 'text/event-stream' in r.headers['content-type']
        r.read()
        content = r.text

    assert 'error' in content
    assert 'Unknown model' in content


def test_delete_model_returns_400_when_not_installed(engine_dir):
    app = create_app(engine_dir=engine_dir)
    client = TestClient(app)
    r = client.delete('/models/z-image')
    assert r.status_code == 400
    assert 'not installed' in r.json()['detail'].lower()
