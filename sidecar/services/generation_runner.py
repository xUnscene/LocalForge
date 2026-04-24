import os
import threading
import time
from dataclasses import dataclass, replace

import httpx
from PIL import Image


@dataclass
class GenerationProgress:
    status: str = 'idle'  # 'idle' | 'queued' | 'generating' | 'complete' | 'error'
    percent: int = 0
    seed: int = 0
    output_path: str | None = None
    thumbnail_path: str | None = None
    error: str | None = None


class GenerationRunner:
    def __init__(self, comfyui_url: str, output_dir: str) -> None:
        self.comfyui_url = comfyui_url
        self.output_dir = output_dir
        self._progress = GenerationProgress()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def get_progress(self) -> GenerationProgress:
        with self._lock:
            p = self._progress
            return replace(p)

    def start(self, workflow: dict, seed: int) -> str | None:
        """Start generation. Returns error string if already running, else None."""
        with self._lock:
            if self._thread and self._thread.is_alive():
                return 'Generation already in progress'
            self._progress = GenerationProgress(status='queued', seed=seed)
            self._thread = threading.Thread(target=self._run, args=(workflow, seed), daemon=True)
        self._thread.start()
        return None

    def _set(self, **kwargs) -> None:
        with self._lock:
            for k, v in kwargs.items():
                setattr(self._progress, k, v)

    def _make_thumbnail(self, output_path: str) -> str | None:
        try:
            thumb_dir = os.path.normpath(os.path.join(self.output_dir, '..', 'thumbnails'))
            os.makedirs(thumb_dir, exist_ok=True)
            stem = os.path.splitext(os.path.basename(output_path))[0]
            thumb_path = os.path.join(thumb_dir, f'{stem}_thumb.jpg')
            with Image.open(output_path) as img:
                img.thumbnail((256, 256), Image.LANCZOS)
                with img.convert('RGB') as rgb:
                    rgb.save(thumb_path, 'JPEG', quality=85)
            return thumb_path
        except Exception:
            return None

    def _run(self, workflow: dict, seed: int) -> None:
        try:
            r = httpx.post(
                f'{self.comfyui_url}/prompt',
                json={'prompt': workflow, 'client_id': 'localforge'},
                timeout=10.0,
            )
            r.raise_for_status()
            prompt_id = r.json()['prompt_id']

            # Node '5' is the KSampler by convention in LocalForge workflows
            total = max(workflow.get('5', {}).get('inputs', {}).get('steps', 20), 1)
            step = 0

            while True:
                time.sleep(0.5)
                r = httpx.get(f'{self.comfyui_url}/history/{prompt_id}', timeout=5.0)
                r.raise_for_status()
                history = r.json()

                if prompt_id not in history:
                    step = min(step + 1, total - 1)
                    self._set(status='generating', percent=int(step / total * 100))
                    continue

                job = history[prompt_id]

                # Check for error
                status_str = job.get('status', {}).get('status_str', '')
                if status_str == 'error':
                    msgs = job.get('status', {}).get('messages', [])
                    if msgs:
                        last = msgs[-1]
                        # ComfyUI messages are [event_name, data] pairs
                        payload = last[1] if len(last) > 1 else last[0]
                        if isinstance(payload, dict):
                            error_msg = payload.get('exception_message') or payload.get('message') or str(payload)
                        else:
                            error_msg = str(payload)
                    else:
                        error_msg = 'Unknown ComfyUI error'
                    self._set(status='error', error=error_msg)
                    return

                # Check for outputs
                for node_output in job.get('outputs', {}).values():
                    images = node_output.get('images', [])
                    if images:
                        filename = images[0]['filename']
                        out_path = os.path.join(self.output_dir, filename)
                        thumb_path = self._make_thumbnail(out_path)
                        self._set(status='complete', percent=100, output_path=out_path,
                                  thumbnail_path=thumb_path)
                        return

                # Job in history but no outputs yet — keep polling
                step = min(step + 1, total - 1)
                self._set(status='generating', percent=int(step / total * 100))

        except Exception as e:
            self._set(status='error', error=str(e))
