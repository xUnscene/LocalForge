import asyncio
import json
import os
import random

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from services.generation_runner import GenerationRunner
from services.prompt_assembler import assemble_prompt, build_workflow

router = APIRouter()


def _runner(request: Request) -> GenerationRunner:
    return request.app.state.runner


@router.post('/generate')
async def generate(request: Request) -> StreamingResponse:
    body = await request.json()
    subject = body.get('subject', '')
    style = body.get('style', 'cinematic')
    shot = body.get('shot', {})
    seed = body.get('seed') or random.randint(0, 2 ** 32 - 1)

    prompt = assemble_prompt(subject, style, shot)
    workflow = build_workflow(prompt, seed, shot.get('ratio', '16:9'))

    runner = _runner(request)
    error = runner.start(workflow, seed)

    async def event_stream():
        if error:
            data = json.dumps({
                'status': 'error', 'percent': 0, 'seed': seed,
                'output_path': None, 'thumbnail_path': None,
                'error': error, 'prompt': prompt,
            })
            yield f'data: {data}\n\n'
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
