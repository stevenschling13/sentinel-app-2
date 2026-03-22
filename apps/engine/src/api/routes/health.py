from fastapi import APIRouter, Depends

from src.api.deps import get_settings
from src.config import Settings

router = APIRouter()


@router.get("/health")
async def health_check(settings: Settings = Depends(get_settings)) -> dict:  # noqa: B008
    """Return service health status."""
    return {
        "status": "ok",
        "service": "sentinel-engine",
        "dependencies": {
            "polygon": bool(settings.polygon_api_key),
            "alpaca": bool(settings.alpaca_api_key and settings.alpaca_secret_key),
            "supabase": bool(settings.supabase_url and settings.supabase_service_role_key),
        },
    }
