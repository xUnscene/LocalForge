import os
import time
import threading
from unittest.mock import MagicMock, patch

from PIL import Image as PILImage

from services.generation_runner import GenerationRunner


def _make_mock_response(json_data: dict) -> MagicMock:
    r = MagicMock()
    r.json.return_value = json_data
    r.raise_for_status = MagicMock()
    return r


def test_runner_starts_in_idle(tmp_path):
    runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path))
    assert runner.get_progress().status == 'idle'


def test_runner_completes_generation(tmp_path):
    prompt_id = 'pid-001'
    call_count = 0

    def mock_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _make_mock_response({})  # not in history yet
        return _make_mock_response({
            prompt_id: {'outputs': {'7': {'images': [{'filename': 'localforge_00001.png'}]}}}
        })

    with patch('httpx.post', return_value=_make_mock_response({'prompt_id': prompt_id})), \
         patch('httpx.get', side_effect=mock_get), \
         patch('time.sleep'):
        runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path))
        runner.start({'5': {'inputs': {'steps': 20}}}, seed=42)
        runner._thread.join(timeout=5.0)

    p = runner.get_progress()
    assert p.status == 'complete'
    assert 'localforge_00001.png' in p.output_path
    assert p.seed == 42


def test_runner_reports_error_on_http_failure(tmp_path):
    with patch('httpx.post', side_effect=Exception('Connection refused')), \
         patch('time.sleep'):
        runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path))
        runner.start({}, seed=0)
        runner._thread.join(timeout=5.0)

    p = runner.get_progress()
    assert p.status == 'error'
    assert 'Connection refused' in p.error


def test_runner_noop_when_already_running(tmp_path):
    started = threading.Event()

    runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path))

    def slow_run(workflow, seed):
        started.set()
        time.sleep(10)

    runner._run = slow_run
    runner.start({}, seed=0)
    started.wait(timeout=2)
    first_thread = runner._thread
    runner.start({}, seed=0)
    assert runner._thread is first_thread


def test_make_thumbnail_creates_jpeg_in_thumbnails_dir(tmp_path):
    output_dir = tmp_path / 'output'
    output_dir.mkdir()
    img_path = output_dir / 'ComfyUI_00001_.png'
    PILImage.new('RGB', (1024, 1024), color=(128, 64, 32)).save(img_path)

    runner = GenerationRunner('http://127.0.0.1:8188', str(output_dir))
    thumb_path = runner._make_thumbnail(str(img_path))

    assert thumb_path is not None
    assert os.path.isfile(thumb_path)
    assert thumb_path.endswith('_thumb.jpg')
    with PILImage.open(thumb_path) as t:
        assert max(t.size) <= 256


def test_make_thumbnail_returns_none_on_missing_file(tmp_path):
    runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path / 'output'))
    result = runner._make_thumbnail('/nonexistent/does-not-exist.png')
    assert result is None


def test_runner_sets_thumbnail_path_on_completion(tmp_path):
    output_dir = tmp_path / 'output'
    output_dir.mkdir()
    img_path = output_dir / 'localforge_00001.png'
    PILImage.new('RGB', (512, 512)).save(img_path)

    prompt_id = 'pid-thumb'
    call_count = 0

    def mock_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _make_mock_response({})
        return _make_mock_response({
            prompt_id: {'outputs': {'7': {'images': [{'filename': 'localforge_00001.png'}]}}}
        })

    with patch('httpx.post', return_value=_make_mock_response({'prompt_id': prompt_id})), \
         patch('httpx.get', side_effect=mock_get), \
         patch('time.sleep'):
        runner = GenerationRunner('http://127.0.0.1:8188', str(output_dir))
        runner.start({'5': {'inputs': {'steps': 20}}}, seed=42)
        runner._thread.join(timeout=5.0)

    p = runner.get_progress()
    assert p.status == 'complete'
    assert p.thumbnail_path is not None
    assert p.thumbnail_path.endswith('_thumb.jpg')
    assert os.path.isfile(p.thumbnail_path)
