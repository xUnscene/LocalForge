import os
from fastapi import FastAPI
from services.comfyui_manager import ComfyUIManager


def create_app(engine_dir: str | None = None) -> FastAPI:
    if engine_dir is None:
        engine_dir = os.path.join(os.environ.get('APPDATA', ''), 'LocalForge', 'engine')

    app = FastAPI(title='LocalForge Sidecar', version='1.0.0')
    app.state.engine_dir = engine_dir
    app.state.manager = ComfyUIManager(engine_dir)

    from routers import health, engine
    app.include_router(health.router)
    app.include_router(engine.router, prefix='/engine')

    return app
