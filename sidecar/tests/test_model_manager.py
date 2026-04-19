import os
from unittest.mock import patch, MagicMock

from services.model_manager import ModelManager, MODEL_CATALOG


def test_is_installed_returns_false_when_file_missing(tmp_path):
    manager = ModelManager(str(tmp_path / 'engine'))
    assert manager.is_installed('z-image') is False


def test_is_installed_returns_true_when_file_exists(tmp_path):
    engine_dir = str(tmp_path / 'engine')
    manager = ModelManager(engine_dir)
    checkpoints = os.path.join(engine_dir, 'ComfyUI', 'models', 'checkpoints')
    os.makedirs(checkpoints)
    open(os.path.join(checkpoints, 'zimage.safetensors'), 'w').close()
    assert manager.is_installed('z-image') is True


def test_list_models_includes_badge_and_install_status(tmp_path):
    manager = ModelManager(str(tmp_path / 'engine'))
    models = manager.list_models(vram_gb=16.0)
    assert len(models) == 1
    m = models[0]
    assert m['id'] == 'z-image'
    assert m['installed'] is False
    assert m['badge'] == 'Perfect for your GPU'
    assert 'vram_required_gb' in m
    assert 'download_size_gb' in m


def test_list_models_badge_insufficient_vram(tmp_path):
    manager = ModelManager(str(tmp_path / 'engine'))
    models = manager.list_models(vram_gb=4.0)
    assert models[0]['badge'] == 'Needs 8GB+ VRAM'


def test_remove_deletes_file(tmp_path):
    engine_dir = str(tmp_path / 'engine')
    manager = ModelManager(engine_dir)
    checkpoints = os.path.join(engine_dir, 'ComfyUI', 'models', 'checkpoints')
    os.makedirs(checkpoints)
    filepath = os.path.join(checkpoints, 'zimage.safetensors')
    open(filepath, 'w').close()
    error = manager.remove('z-image')
    assert error is None
    assert not os.path.exists(filepath)
