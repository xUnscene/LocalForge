import asyncio
import json
import random

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

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
            data = json.dumps({'status': 'error', 'percent': 0, 'seed': seed, 'output_path': None, 'error': error, 'prompt': prompt})
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
                'error': p.error,
                'prompt': prompt,  # assembled prompt (subject + style + shot)
            })
            yield f'data: {data}\n\n'
            if p.status in ('complete', 'error'):
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(event_stream(), media_type='text/event-stream')
