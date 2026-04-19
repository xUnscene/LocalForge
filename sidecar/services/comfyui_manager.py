import os
import subprocess
from typing import Optional


class ComfyUIManager:
    COMFYUI_PORT = 8188

    def __init__(self, engine_dir: str) -> None:
        self.engine_dir = engine_dir
        self.comfyui_path = os.path.join(engine_dir, 'ComfyUI')
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
            python = 'python'
        main_script = os.path.join(self.comfyui_path, 'main.py')
        self._process = subprocess.Popen(
            [python, main_script, '--listen', '127.0.0.1',
             '--port', str(self.COMFYUI_PORT), '--disable-auto-launch'],
            cwd=self.comfyui_path,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
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
