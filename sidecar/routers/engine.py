from fastapi import APIRouter, HTTPException, Request
from services.comfyui_manager import ComfyUIManager

router = APIRouter()


def _manager(request: Request) -> ComfyUIManager:
    return request.app.state.manager


@router.get('/status')
def engine_status(request: Request) -> dict:
    return {'status': _manager(request).get_status()}


@router.post('/start')
def engine_start(request: Request) -> dict:
    manager = _manager(request)
    if not manager.is_installed():
        raise HTTPException(status_code=409, detail='ComfyUI is not installed')
    manager.start()
    return {'status': manager.get_status()}


@router.post('/stop')
def engine_stop(request: Request) -> dict:
    manager = _manager(request)
    manager.stop()
    return {'status': manager.get_status()}
