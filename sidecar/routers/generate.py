import asyncio
import json
import os
import random

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from services.comfyui_manager import ComfyUIManager
from services.generation_runner import GenerationRunner
from services.prompt_assembler import assemble_prompt, build_workflow

router = APIRouter()

_COMFYUI_READY_TIMEOUT = 90


def _runner(request: Request) -> GenerationRunner:
    return request.app.state.runner


def _manager(request: Request) -> ComfyUIManager:
    return request.app.state.manager


@router.post('/generate')
async def generate(request: Request) -> StreamingResponse:
    body = await request.json()
    subject = body.get('subject', '')
    style = body.get('style', 'cinematic')
    shot = body.get('shot', {})
    seed = body.get('seed') or random.randint(0, 2 ** 32 - 1)
    raw_model = body.get('model', 'zimage.safetensors')
    checkpoint = request.app.state.model_manager.resolve_checkpoint_filename(raw_model)

    prompt = assemble_prompt(subject, style, shot)
    workflow = build_workflow(prompt, seed, shot.get('ratio', '16:9'), checkpoint)

    manager = _manager(request)
    runner = _runner(request)

    def _err(msg: str) -> str:
        return json.dumps({'status': 'error', 'percent': 0, 'seed': seed,
                           'output_path': None, 'thumbnail_path': None, 'error': msg, 'prompt': prompt})

    async def event_stream():
        if not manager.is_installed():
            yield f'data: {_err("ComfyUI is not installed — complete setup first")}\n\n'
            return

        # Auto-start ComfyUI and stream progress while waiting
        if manager.get_status() != 'running':
            manager.start()
            url = f'http://127.0.0.1:{ComfyUIManager.COMFYUI_PORT}/system_stats'
            deadline = asyncio.get_event_loop().time() + _COMFYUI_READY_TIMEOUT
            ready = False
            async with httpx.AsyncClient() as client:
                while asyncio.get_event_loop().time() < deadline:
                    yield f'data: {json.dumps({"status": "starting_engine", "percent": 0, "seed": seed, "output_path": None, "thumbnail_path": None, "error": None, "prompt": prompt})}\n\n'
                    try:
                        r = await client.get(url, timeout=2.0)
                        if r.status_code == 200:
                            ready = True
                            break
                    except Exception:
                        pass
                    await asyncio.sleep(2.0)

            if not ready:
                yield f'data: {_err(f"ComfyUI did not start within {_COMFYUI_READY_TIMEOUT}s — check sidecar.log")}\n\n'
                return

        start_err = runner.start(workflow, seed)
        if start_err:
            yield f'data: {_err(start_err)}\n\n'
            return

        while True:
            if await request.is_disconnected():
                break
            p = runner.get_progress()
            data = json.dumps({
                'status': p.status,
                'percent': p.percent,
                'seed': p.seed,
                'output_path': p.output_path,
                'thumbnail_path': p.thumbnail_path,
                'error': p.error,
                'prompt': prompt,
            })
            yield f'data: {data}\n\n'
            if p.status in ('complete', 'error'):
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@router.get('/output/{filename}')
async def get_output_image(filename: str, request: Request) -> FileResponse:
    output_dir = _runner(request).output_dir
    safe_path = os.path.join(output_dir, os.path.basename(filename))
    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail='Image not found')
    return FileResponse(safe_path)


@router.get('/thumbnail/{filename}')
async def get_thumbnail(filename: str, request: Request) -> FileResponse:
    output_dir = _runner(request).output_dir
    thumb_dir = os.path.normpath(os.path.join(output_dir, '..', 'thumbnails'))
    safe_path = os.path.join(thumb_dir, os.path.basename(filename))
    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail='Thumbnail not found')
    return FileResponse(safe_path)
