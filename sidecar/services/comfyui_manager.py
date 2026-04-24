import os
import subprocess
from typing import Optional, IO


class ComfyUIManager:
    COMFYUI_PORT = 8188

    def __init__(self, engine_dir: str, log_path: str | None = None) -> None:
        self.engine_dir = engine_dir
        self.comfyui_path = os.path.join(engine_dir, 'ComfyUI')
        self._log_path = log_path
        self._process: Optional[subprocess.Popen] = None

    def is_installed(self) -> bool:
        return os.path.isdir(self.comfyui_path)

    def get_status(self) -> str:
        if not self.is_installed():
            return 'not_installed'
        if self._process is None:
            return 'stopped'
        returncode = self._process.poll()
        if returncode is not None:
            self._process = None
            return 'stopped' if returncode == 0 else 'error'
        return 'running'

    def start(self) -> bool:
        if not self.is_installed():
            return False
        if self._process and self._process.poll() is None:
            return True
        python = os.path.join(self.comfyui_path, 'venv', 'Scripts', 'python.exe')
        if not os.path.isfile(python):
            python = 'py'  # falls back to py -3.10 venv if present
        main_script = os.path.join(self.comfyui_path, 'main.py')
        log_fh: IO[bytes] | int = subprocess.DEVNULL
        if self._log_path:
            os.makedirs(os.path.dirname(self._log_path), exist_ok=True)
            log_fh = open(self._log_path, 'ab')
        self._process = subprocess.Popen(
            [python, main_script, '--listen', '127.0.0.1',
             '--port', str(self.COMFYUI_PORT), '--disable-auto-launch'],
            cwd=self.comfyui_path,
            stdout=log_fh,
            stderr=log_fh,
        )
        return True

    def stop(self) -> None:
        if self._process:
            self._process.terminate()
            try:
                self._process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._process.kill()
                self._process.wait()  # reap the terminated process
            self._process = None
