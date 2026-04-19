from unittest.mock import patch, MagicMock
from services.gpu_detector import detect_gpu, GpuInfo


def _mock_run(stdout: str, returncode: int = 0) -> MagicMock:
    mock = MagicMock()
    mock.returncode = returncode
    mock.stdout = stdout
    return mock


def test_detect_gpu_parses_name_and_vram():
    with patch('subprocess.run', return_value=_mock_run('NVIDIA GeForce RTX 3090, 24576\n')):
        info = detect_gpu()
    assert info is not None
    assert info.name == 'NVIDIA GeForce RTX 3090'
    assert info.vram_gb == 24.0
    assert info.sufficient is True


def test_detect_gpu_flags_insufficient_vram():
    with patch('subprocess.run', return_value=_mock_run('NVIDIA GeForce RTX 3060, 6144\n')):
        info = detect_gpu()
    assert info is not None
    assert info.vram_gb == 6.0
    assert info.sufficient is False


def test_detect_gpu_returns_none_when_nvidia_smi_missing():
    with patch('subprocess.run', side_effect=FileNotFoundError()):
        assert detect_gpu() is None


def test_detect_gpu_returns_none_when_nonzero_exit():
    with patch('subprocess.run', return_value=_mock_run('', returncode=1)):
        assert detect_gpu() is None
