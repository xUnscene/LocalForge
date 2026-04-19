from fastapi import APIRouter

router = APIRouter()


@router.get('/health')
def health() -> dict:
    return {'status': 'running', 'version': '1.0.0'}
