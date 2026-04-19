import os
import threading
from dataclasses import dataclass, replace

import httpx

MODEL_CATALOG: list[dict] = [
    {
        'id': 'z-image',
        'name': 'Z-Image (Lumina-2)',
        'description': 'High-quality cinematic image generation optimized for portraiture and scenes.',
        'vram_required_gb': 8,
        'download_size_gb': 6.5,
        'repo': 'https://huggingface.co/Alpha-VLLM/Lumina-2.0/resolve/main/lumina2.0.safetensors',
        'filename': 'zimage.safetensors',
    },
]


@dataclass
class ModelProgress:
    status: str = 'idle'  # 'idle' | 'downloading' | 'complete' | 'error'
    percent: int = 0
    error: str | None = None


class ModelManager:
    def __init__(self, engine_dir: str) -> None:
        self.engine_dir = engine_dir
        self._progress: dict[str, ModelProgress] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._lock = threading.Lock()

    def _checkpoints_dir(self) -> str:
        return os.path.join(self.engine_dir, 'ComfyUI', 'models', 'checkpoints')

    def _model_path(self, model: dict) -> str:
        return os.path.join(self._checkpoints_dir(), model['filename'])

    def _find(self, model_id: str) -> dict | None:
        return next((m for m in MODEL_CATALOG if m['id'] == model_id), None)

    def is_installed(self, model_id: str) -> bool:
        model = self._find(model_id)
        if model is None:
            return False
        return os.path.isfile(self._model_path(model))

    def size_on_disk_gb(self, model_id: str) -> float | None:
        model = self._find(model_id)
        if model is None:
            return None
        path = self._model_path(model)
        if not os.path.isfile(path):
            return None
        return round(os.path.getsize(path) / (1024 ** 3), 2)

    def _badge(self, model: dict, vram_gb: float | None) -> str:
        if vram_gb is None:
            return 'GPU required'
        if vram_gb >= model['vram_required_gb']:
            return 'Perfect for your GPU'
        return f'Needs {model["vram_required_gb"]}GB+ VRAM'

    def list_models(self, vram_gb: float | None) -> list[dict]:
        result = []
        for m in MODEL_CATALOG:
            installed = self.is_installed(m['id'])
            result.append({
                'id': m['id'],
                'name': m['name'],
                'description': m['description'],
                'vram_required_gb': m['vram_required_gb'],
                'download_size_gb': m['download_size_gb'],
                'installed': installed,
                'size_on_disk_gb': self.size_on_disk_gb(m['id']) if installed else None,
                'badge': self._badge(m, vram_gb),
            })
        return result

    def get_progress(self, model_id: str) -> ModelProgress:
        with self._lock:
            p = self._progress.get(model_id, ModelProgress())
            return replace(p)

    # Cancellation is not supported in v1 — a started download runs to completion or error.
    def start_install(self, model_id: str) -> str | None:
        """Returns error string if busy or model unknown, else None."""
        model = self._find(model_id)
        if model is None:
            return f'Unknown model: {model_id}'
        with self._lock:
            t = self._threads.get(model_id)
            if t and t.is_alive():
                return 'Download already in progress'
            self._progress[model_id] = ModelProgress(status='downloading', percent=0)
            t = threading.Thread(target=self._download, args=(model,), daemon=True)
            self._threads[model_id] = t
        t.start()
        return None

    def remove(self, model_id: str) -> str | None:
        """Returns error string if not installed or not found, else None."""
        model = self._find(model_id)
        if model is None:
            return f'Unknown model: {model_id}'
        with self._lock:
            t = self._threads.get(model_id)
            if t and t.is_alive():
                return 'Cannot remove: download in progress'
        path = self._model_path(model)
        if not os.path.isfile(path):
            return 'Model not installed'
        # Also clean up any stale .part file
        part_path = path + '.part'
        if os.path.exists(part_path):
            os.remove(part_path)
        os.remove(path)
        return None

    def _set_progress(self, model_id: str, **kwargs) -> None:
        with self._lock:
            current = self._progress.get(model_id, ModelProgress())
            self._progress[model_id] = replace(current, **kwargs)

    def _download(self, model: dict) -> None:
        model_id = model['id']
        dest_path = self._model_path(model)
        part_path = dest_path + '.part'
        try:
            os.makedirs(self._checkpoints_dir(), exist_ok=True)
            with httpx.stream('GET', model['repo'], follow_redirects=True,
                              timeout=httpx.Timeout(connect=30.0, read=120.0)) as r:
                r.raise_for_status()
                total = int(r.headers.get('content-length', 0))
                downloaded = 0
                with open(part_path, 'wb') as f:
                    for chunk in r.iter_bytes(chunk_size=1024 * 1024):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            self._set_progress(model_id, percent=int(downloaded / total * 100))
                        else:
                            # Content-length missing — show indeterminate progress
                            self._set_progress(model_id, percent=-1)
            os.replace(part_path, dest_path)
            self._set_progress(model_id, status='complete', percent=100)
        except Exception as e:
            if os.path.exists(part_path):
                os.remove(part_path)
            self._set_progress(model_id, status='error', error=str(e))
