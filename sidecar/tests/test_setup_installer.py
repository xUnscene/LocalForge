import io
import os
import time
import zipfile
from unittest.mock import MagicMock, patch

from services.setup_installer import SetupInstaller


def _make_zip(contents: dict) -> bytes:
    """Create a ZIP with a top-level directory prefix (like GitHub release ZIPs)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        for name, data in contents.items():
            zf.writestr(f'repo-main/{name}', data)
    return buf.getvalue()


def _mock_stream(zip_bytes: bytes) -> MagicMock:
    """Mock httpx.stream context manager returning zip_bytes."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.headers = {'content-length': str(len(zip_bytes))}
    mock_response.iter_bytes.return_value = [zip_bytes]
    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=mock_response)
    ctx.__exit__ = MagicMock(return_value=False)
    return ctx


def _wait_for_phase(installer: SetupInstaller, target_phases: set, timeout: float = 5.0) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        phase = installer.get_progress().phase
        if phase in target_phases:
            return phase
        time.sleep(0.05)
    return installer.get_progress().phase


def test_installer_starts_in_idle(tmp_path):
    installer = SetupInstaller(str(tmp_path))
    assert installer.get_progress().phase == 'idle'


def _make_mock_popen():
    mock_proc = MagicMock()
    mock_proc.stdout = iter([])
    mock_proc.wait.return_value = 0
    mock_proc.returncode = 0
    return mock_proc


def test_installer_reports_complete_after_install(tmp_path):
    comfyui_zip = _make_zip({'main.py': b'comfyui', 'requirements.txt': b''})
    lumina_zip = _make_zip({'nodes.py': b'lumina'})
    with patch('httpx.stream', side_effect=[_mock_stream(comfyui_zip), _mock_stream(lumina_zip)]), \
         patch('subprocess.run'), \
         patch('subprocess.Popen', return_value=_make_mock_popen()):
        installer = SetupInstaller(str(tmp_path))
        installer.start()
        phase = _wait_for_phase(installer, {'complete', 'error'})
    assert phase == 'complete'
    assert os.path.isdir(os.path.join(str(tmp_path), 'ComfyUI'))


def test_installer_reports_error_on_download_failure(tmp_path):
    with patch('httpx.stream', side_effect=Exception('network error')):
        installer = SetupInstaller(str(tmp_path))
        installer.start()
        phase = _wait_for_phase(installer, {'complete', 'error'})
    assert phase == 'error'
    assert 'network error' in installer.get_progress().error


def test_installer_second_start_is_noop_when_running(tmp_path):
    import threading
    installer = SetupInstaller(str(tmp_path))
    started = threading.Event()

    original_run = installer._run
    def slow_run():
        started.set()
        time.sleep(10)
    installer._run = slow_run

    installer.start()
    started.wait(timeout=2)
    first_thread = installer._thread
    installer.start()
    assert installer._thread is first_thread
