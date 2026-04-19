import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from services.comfyui_manager import ComfyUIManager
from services.setup_installer import SetupInstaller
from services.generation_runner import GenerationRunner


def create_app(engine_dir: str | None = None) -> FastAPI:
    if engine_dir is None:
        engine_dir = os.path.join(os.environ.get('APPDATA', ''), 'LocalForge', 'engine')

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        app.state.manager.stop()

    app = FastAPI(title='LocalForge Sidecar', version='1.0.0', lifespan=lifespan)
    app.state.engine_dir = engine_dir
    app.state.manager = ComfyUIManager(engine_dir)
    app.state.installer = SetupInstaller(engine_dir)
    app.state.runner = GenerationRunner(
        comfyui_url='http://127.0.0.1:8188',
        output_dir=os.path.join(engine_dir, 'ComfyUI', 'output'),
    )

    from routers import health, engine, setup, generate
    app.include_router(health.router)
    app.include_router(engine.router, prefix='/engine')
    app.include_router(setup.router, prefix='/setup')
    app.include_router(generate.router)

    return app
