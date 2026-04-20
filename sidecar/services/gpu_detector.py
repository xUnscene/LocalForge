import subprocess
from dataclasses import dataclass


@dataclass
class GpuInfo:
    name: str
    vram_gb: float
    sufficient: bool  # vram_gb >= 8


_NVIDIA_SMI_PATHS = [
    'nvidia-smi',
    r'C:\Windows\System32\nvidia-smi.exe',
    r'C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe',
]


def detect_gpu() -> GpuInfo | None:
    for smi in _NVIDIA_SMI_PATHS:
        try:
            result = subprocess.run(
                [smi, '--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                break
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
    else:
        return None
    try:
        line = result.stdout.strip().splitlines()[0]
        name, vram_mb = line.rsplit(', ', 1)
        vram_gb = round(int(vram_mb.strip()) / 1024, 1)
        return GpuInfo(name=name.strip(), vram_gb=vram_gb, sufficient=vram_gb >= 8)
    except (ValueError, IndexError):
        return None
