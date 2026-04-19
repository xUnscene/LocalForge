import os
import pytest
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
