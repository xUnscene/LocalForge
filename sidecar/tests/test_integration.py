import re
import subprocess
import sys
import time

import httpx
import pytest


@pytest.fixture
def running_sidecar():
    proc = subprocess.Popen(
        [sys.executable, 'main.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd='.',
    )
    port = None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = proc.stdout.readline()
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
