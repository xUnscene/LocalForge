import subprocess
from dataclasses import dataclass


@dataclass
class GpuInfo:
    name: str
    vram_gb: float
    sufficient: bool  # vram_gb >= 8


def detect_gpu() -> GpuInfo | None:
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return None
        line = result.stdout.strip().splitlines()[0]
        name, vram_mb = line.split(', ')
        vram_gb = round(int(vram_mb.strip()) / 1024, 1)
        return GpuInfo(name=name.strip(), vram_gb=vram_gb, sufficient=vram_gb >= 8)
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError, IndexError):
        return None
