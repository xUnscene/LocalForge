import pathlib
import re
import subprocess
import sys
import time

import httpx
import pytest

_SIDECAR_DIR = pathlib.Path(__file__).parent.parent  # sidecar/


@pytest.fixture
def running_sidecar():
    proc = subprocess.Popen(
        [sys.executable, str(_SIDECAR_DIR / 'main.py')],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(_SIDECAR_DIR),
    )
    port = None
    deadline = time.time() + 10
    while time.time() < deadline:
        if proc.poll() is not None:
            pytest.fail(f'Sidecar exited (code {proc.returncode}) before reporting PORT')
        line = proc.stdout.readline()
        if not line:
            continue
        match = re.search(r'PORT=(\d+)', line)
        if match:
            port = int(match.group(1))
            break
    if port is None:
        proc.kill()
        pytest.fail('Sidecar did not report PORT within 10 seconds')
    time.sleep(0.5)
    yield port
    proc.terminate()
    proc.wait(timeout=5)


def test_sidecar_reports_port_and_serves_health(running_sidecar):
    port = running_sidecar
    response = httpx.get(f'http://127.0.0.1:{port}/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'running'


def test_sidecar_engine_status_not_installed(running_sidecar):
    port = running_sidecar
    response = httpx.get(f'http://127.0.0.1:{port}/engine/status')
    assert response.status_code == 200
    assert response.json()['status'] == 'not_installed'
