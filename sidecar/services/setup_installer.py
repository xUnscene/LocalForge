import os
import threading
import zipfile
from dataclasses import dataclass

import httpx

COMFYUI_VERSION = 'v0.3.43'
COMFYUI_ZIP_URL = (
    f'https://github.com/comfyanonymous/ComfyUI/archive/refs/tags/{COMFYUI_VERSION}.zip'
)
LUMINA_ZIP_URL = (
    'https://github.com/kijai/ComfyUI-LuminaWrapper/archive/refs/heads/main.zip'
)


@dataclass
class InstallProgress:
    phase: str = 'idle'
    percent: int = 0
    error: str | None = None


class SetupInstaller:
    def __init__(self, engine_dir: str) -> None:
        self.engine_dir = engine_dir
        self._progress = InstallProgress()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def get_progress(self) -> InstallProgress:
        with self._lock:
            return InstallProgress(
                phase=self._progress.phase,
                percent=self._progress.percent,
                error=self._progress.error,
            )

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _set(self, phase: str, percent: int = 0, error: str | None = None) -> None:
        with self._lock:
            self._progress.phase = phase
            self._progress.percent = percent
            self._progress.error = error

    def _download(self, url: str, dest_path: str, phase: str) -> None:
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        self._set(phase, 0)
        with httpx.stream('GET', url, follow_redirects=True, timeout=300) as r:
            r.raise_for_status()
            total = int(r.headers.get('content-length', 0))
            downloaded = 0
            with open(dest_path, 'wb') as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        with self._lock:
                            self._progress.percent = int(downloaded / total * 100)

    def _extract(self, zip_path: str, dest_dir: str, phase: str) -> None:
        self._set(phase, 0)
        os.makedirs(dest_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            members = zf.namelist()
            prefix = members[0].split('/')[0] + '/' if members else ''
            for i, member in enumerate(members):
                target = member[len(prefix):]
                if not target:
                    continue
                target_path = os.path.join(dest_dir, target)
                if member.endswith('/'):
                    os.makedirs(target_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with zf.open(member) as src, open(target_path, 'wb') as dst:
                        dst.write(src.read())
                with self._lock:
                    self._progress.percent = int((i + 1) / len(members) * 100)

    def _run(self) -> None:
        try:
            tmp_dir = os.path.join(self.engine_dir, '.tmp')
            comfyui_zip = os.path.join(tmp_dir, 'comfyui.zip')
            lumina_zip = os.path.join(tmp_dir, 'lumina.zip')
            comfyui_dir = os.path.join(self.engine_dir, 'ComfyUI')
            lumina_dir = os.path.join(comfyui_dir, 'custom_nodes', 'ComfyUI-LuminaWrapper')

            self._download(COMFYUI_ZIP_URL, comfyui_zip, 'downloading_comfyui')
            self._extract(comfyui_zip, comfyui_dir, 'extracting_comfyui')
            os.remove(comfyui_zip)

            self._download(LUMINA_ZIP_URL, lumina_zip, 'downloading_lumina')
            self._extract(lumina_zip, lumina_dir, 'extracting_lumina')
            os.remove(lumina_zip)

            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass

            self._set('complete', 100)
        except Exception as e:
            self._set('error', 0, str(e))
