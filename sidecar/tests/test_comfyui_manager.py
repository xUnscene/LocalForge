import os
import pytest
from unittest.mock import MagicMock
from services.comfyui_manager import ComfyUIManager


@pytest.fixture
def manager(tmp_path) -> ComfyUIManager:
    return ComfyUIManager(engine_dir=str(tmp_path))


def test_not_installed_when_comfyui_dir_missing(manager):
    assert manager.is_installed() is False


def test_status_is_not_installed_when_missing(manager):
    assert manager.get_status() == 'not_installed'


def test_installed_when_comfyui_dir_exists(manager, tmp_path):
    comfyui_dir = tmp_path / 'ComfyUI'
    comfyui_dir.mkdir()
    assert manager.is_installed() is True


def test_status_is_stopped_when_installed_but_not_running(manager, tmp_path):
    (tmp_path / 'ComfyUI').mkdir()
    assert manager.get_status() == 'stopped'


def test_stop_is_safe_when_not_running(manager):
    manager.stop()  # should not raise


def test_status_is_error_when_process_exits_unexpectedly(manager, tmp_path):
    (tmp_path / 'ComfyUI').mkdir()
    # Simulate a process that started but has now exited
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 1  # non-None means process exited
    manager._process = mock_proc

    assert manager.get_status() == 'error'
    assert manager._process is None  # should be cleaned up
