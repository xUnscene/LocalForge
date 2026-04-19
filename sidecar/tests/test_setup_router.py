from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app import create_app
from services.gpu_detector import GpuInfo


def test_gpu_info_when_no_gpu(engine_dir):
    with patch('routers.setup.detect_gpu', return_value=None):
        app = create_app(engine_dir=engine_dir)
        client = TestClient(app)
        response = client.get('/setup/gpu-info')
    assert response.status_code == 200
    data = response.json()
    assert data['detected'] is False
    assert data['name'] is None
    assert data['sufficient'] is False


def test_gpu_info_when_gpu_found(engine_dir):
    mock_info = GpuInfo(name='RTX 4090', vram_gb=24.0, sufficient=True)
    with patch('routers.setup.detect_gpu', return_value=mock_info):
        app = create_app(engine_dir=engine_dir)
        client = TestClient(app)
        response = client.get('/setup/gpu-info')
    assert response.status_code == 200
    data = response.json()
    assert data['detected'] is True
    assert data['name'] == 'RTX 4090'
    assert data['vram_gb'] == 24.0
    assert data['sufficient'] is True


def test_install_calls_installer_start(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_installer = MagicMock()
    app.state.installer = mock_installer
    client = TestClient(app)
    response = client.post('/setup/install')
    assert response.status_code == 200
    assert response.json()['started'] is True
    mock_installer.start.assert_called_once()
