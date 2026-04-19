import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from services.gpu_detector import detect_gpu
from services.setup_installer import SetupInstaller

router = APIRouter()


def _installer(request: Request) -> SetupInstaller:
    return request.app.state.installer


@router.get('/gpu-info')
def gpu_info() -> dict:
    info = detect_gpu()
    if info is None:
        return {'detected': False, 'name': None, 'vram_gb': None, 'sufficient': False}
    return {
        'detected': True,
        'name': info.name,
        'vram_gb': info.vram_gb,
        'sufficient': info.sufficient,
    }


@router.post('/install')
def install(request: Request) -> dict:
    _installer(request).start()
    return {'started': True}


@router.get('/progress')
async def progress(request: Request) -> StreamingResponse:
    installer = _installer(request)

    async def event_stream():
        while True:
            if await request.is_disconnected():
                break
            p = installer.get_progress()
            data = json.dumps({'phase': p.phase, 'percent': p.percent, 'error': p.error})
            yield f'data: {data}\n\n'
            if p.phase in ('complete', 'error'):
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(event_stream(), media_type='text/event-stream')
