import json
import os
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app import create_app
from services.generation_runner import GenerationProgress
from PIL import Image as PILImage


def _mock_manager() -> MagicMock:
    m = MagicMock()
    m.is_installed.return_value = True
    m.get_status.return_value = 'running'
    return m


def test_generate_returns_sse_content_type(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_runner = MagicMock()
    mock_runner.start.return_value = None
    mock_runner.get_progress.return_value = GenerationProgress(
        status='complete', percent=100, seed=42, output_path='/out/test.png'
    )
    app.state.runner = mock_runner
    app.state.manager = _mock_manager()

    client = TestClient(app)
    with client.stream('POST', '/generate', json={
        'subject': 'a cat',
        'style': 'cinematic',
        'shot': {'camera': '', 'lens': '', 'lighting': '', 'ratio': '16:9'},
        'seed': 42,
    }) as r:
        assert r.status_code == 200
        assert 'text/event-stream' in r.headers['content-type']
        content = r.read().decode()

    assert 'complete' in content
    mock_runner.start.assert_called_once()


def test_generate_assembles_prompt_into_workflow(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_runner = MagicMock()
    mock_runner.start.return_value = None
    mock_runner.get_progress.return_value = GenerationProgress(
        status='complete', percent=100, seed=7, output_path='/out/img.png'
    )
    app.state.runner = mock_runner
    app.state.manager = _mock_manager()

    client = TestClient(app)
    with client.stream('POST', '/generate', json={
        'subject': 'a woman walking',
        'style': 'cinematic',
        'shot': {'camera': 'Sony A7 IV', 'lens': '35mm f/1.4', 'lighting': 'Natural', 'ratio': '16:9'},
        'seed': 7,
    }) as r:
        r.read()

    call_args = mock_runner.start.call_args
    workflow = call_args[0][0]
    prompt_text = workflow['2']['inputs']['text']
    assert 'a woman walking' in prompt_text
    assert workflow['5']['inputs']['seed'] == 7
    assert workflow['4']['inputs']['width'] == 1280


def test_generate_returns_error_sse_when_runner_busy(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_runner = MagicMock()
    mock_runner.start.return_value = 'Generation already in progress'
    app.state.runner = mock_runner
    app.state.manager = _mock_manager()

    client = TestClient(app)
    with client.stream('POST', '/generate', json={
        'subject': 'test', 'style': 'cinematic',
        'shot': {'camera': '', 'lens': '', 'lighting': '', 'ratio': '16:9'},
    }) as r:
        content = r.read().decode()

    assert 'error' in content
    assert 'already in progress' in content


def test_generate_sse_includes_thumbnail_path(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_runner = MagicMock()
    mock_runner.start.return_value = None
    mock_runner.get_progress.return_value = GenerationProgress(
        status='complete', percent=100, seed=42,
        output_path='/out/test.png',
        thumbnail_path='/out/thumbnails/test_thumb.jpg',
    )
    app.state.runner = mock_runner
    app.state.manager = _mock_manager()

    client = TestClient(app)
    with client.stream('POST', '/generate', json={
        'subject': 'a cat', 'style': 'cinematic',
        'shot': {'camera': '', 'lens': '', 'lighting': '', 'ratio': '16:9'},
        'seed': 42,
    }) as r:
        content = r.read().decode()

    event = json.loads(content.split('data: ')[1].strip())
    assert event['thumbnail_path'] == '/out/thumbnails/test_thumb.jpg'


def test_get_thumbnail_returns_image_file(tmp_path):
    engine_dir = str(tmp_path / 'engine')
    app = create_app(engine_dir=engine_dir)
    thumb_dir = os.path.join(engine_dir, 'ComfyUI', 'thumbnails')
    os.makedirs(thumb_dir, exist_ok=True)
    thumb_path = os.path.join(thumb_dir, 'test_thumb.jpg')
    PILImage.new('RGB', (128, 128), color=(200, 100, 50)).save(thumb_path, 'JPEG')

    client = TestClient(app)
    r = client.get('/thumbnail/test_thumb.jpg')
    assert r.status_code == 200
    assert 'image' in r.headers['content-type']


def test_get_thumbnail_returns_404_for_missing_file(engine_dir):
    app = create_app(engine_dir=engine_dir)
    client = TestClient(app)
    r = client.get('/thumbnail/nonexistent_thumb.jpg')
    assert r.status_code == 404
