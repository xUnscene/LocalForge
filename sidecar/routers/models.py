import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from services.gpu_detector import detect_gpu
from services.model_manager import ModelManager

router = APIRouter()


def _manager(request: Request) -> ModelManager:
    return request.app.state.model_manager


@router.get('/models')
def list_models(request: Request) -> list[dict]:
    gpu = detect_gpu()
    vram_gb = gpu.vram_gb if gpu else None
    return _manager(request).list_models(vram_gb)


@router.post('/models/{model_id}/install')
async def install_model(model_id: str, request: Request) -> StreamingResponse:
    manager = _manager(request)
    error = manager.start_install(model_id)

    async def event_stream():
        if error:
            data = json.dumps({'status': 'error', 'percent': 0, 'error': error})
            yield f'data: {data}\n\n'
            return
        while True:
            if await request.is_disconnected():
                break
            p = manager.get_progress(model_id)
            data = json.dumps({'status': p.status, 'percent': p.percent, 'error': p.error})
            yield f'data: {data}\n\n'
            if p.status in ('complete', 'error'):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@router.delete('/models/{model_id}')
def remove_model(model_id: str, request: Request) -> dict:
    error = _manager(request).remove(model_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {'removed': True}
