import os
import subprocess
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
TORCH_INDEX_URL = 'https://download.pytorch.org/whl/cu124'


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
        self._set('idle', 0)
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
        part_path = dest_path + '.part'
        with httpx.stream('GET', url, follow_redirects=True, timeout=httpx.Timeout(300.0)) as r:
            r.raise_for_status()
            total = int(r.headers.get('content-length', 0))
            downloaded = 0
            with open(part_path, 'wb') as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        with self._lock:
                            self._progress.percent = int(downloaded / total * 100)
        os.replace(part_path, dest_path)

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
                target_path = os.path.realpath(os.path.join(dest_dir, target))
                real_dest = os.path.realpath(dest_dir)
                if not target_path.startswith(real_dest + os.sep) and target_path != real_dest:
                    raise ValueError(f'Path traversal detected in ZIP: {member}')
                if member.endswith('/'):
                    os.makedirs(target_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with zf.open(member) as src, open(target_path, 'wb') as dst:
                        dst.write(src.read())
                with self._lock:
                    self._progress.percent = int((i + 1) / len(members) * 100)

    def _pip_install(self, pip: str, args: list[str], phase: str) -> None:
        """Run a pip install command, pulsing progress as output arrives."""
        self._set(phase, 5)
        cmd = [pip, 'install'] + args
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
        )
        pulse = 5
        lines: list[str] = []
        for line in proc.stdout:  # type: ignore[union-attr]
            lines.append(line)
            pulse = min(pulse + 1, 92)
            with self._lock:
                self._progress.percent = pulse
        proc.wait()
        if proc.returncode != 0:
            tail = ''.join(lines[-30:])
            raise RuntimeError(f'{phase} failed (exit {proc.returncode}):\n{tail}')
        self._set(phase, 100)

    def _run(self) -> None:
        try:
            result = subprocess.run(['py', '-3.10', '--version'], capture_output=True)
            if result.returncode != 0:
                raise RuntimeError(
                    'Python 3.10 is required but was not found. '
                    'Download it from https://www.python.org/downloads/ and re-run setup.'
                )

            tmp_dir = os.path.join(self.engine_dir, '.tmp')
            comfyui_zip = os.path.join(tmp_dir, 'comfyui.zip')
            lumina_zip = os.path.join(tmp_dir, 'lumina.zip')
            comfyui_dir = os.path.join(self.engine_dir, 'ComfyUI')
            venv_dir = os.path.join(comfyui_dir, 'venv')
            pip = os.path.join(venv_dir, 'Scripts', 'pip.exe')
            lumina_dir = os.path.join(comfyui_dir, 'custom_nodes', 'ComfyUI-LuminaWrapper')

            self._download(COMFYUI_ZIP_URL, comfyui_zip, 'downloading_comfyui')
            self._extract(comfyui_zip, comfyui_dir, 'extracting_comfyui')
            os.remove(comfyui_zip)

            # Create venv and install ComfyUI dependencies
            self._set('creating_venv', 10)
            subprocess.run(['py', '-3.10', '-m', 'venv', venv_dir], check=True)
            self._set('creating_venv', 100)

            self._pip_install(pip, [
                'torch', 'torchvision',
                '--index-url', TORCH_INDEX_URL,
            ], 'installing_torch')

            req_txt = os.path.join(comfyui_dir, 'requirements.txt')
            self._pip_install(pip, ['-r', req_txt], 'installing_comfyui_deps')
            # 'requests' is not always pulled in transitively but ComfyUI v0.3.43+ requires it
            self._pip_install(pip, ['requests'], 'installing_comfyui_deps')

            self._download(LUMINA_ZIP_URL, lumina_zip, 'downloading_lumina')
            self._extract(lumina_zip, lumina_dir, 'extracting_lumina')
            os.remove(lumina_zip)

            lumina_req = os.path.join(lumina_dir, 'requirements.txt')
            if os.path.isfile(lumina_req):
                self._pip_install(pip, ['-r', lumina_req], 'installing_lumina_deps')

            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass

            self._set('complete', 100)
        except Exception as e:
            self._set('error', 0, str(e))
