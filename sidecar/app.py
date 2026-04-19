import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from services.comfyui_manager import ComfyUIManager
from services.setup_installer import SetupInstaller


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

    from routers import health, engine, setup
    app.include_router(health.router)
    app.include_router(engine.router, prefix='/engine')
    app.include_router(setup.router, prefix='/setup')

    return app
