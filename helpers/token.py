import os
import httpx
import asyncio
import time
import base64
import logging


_cached_token = None
_cached_token_time = 0
_TOKEN_CACHE_SECONDS = 59 * 60


def get_pmt_access_token() -> str:
    """
    Fetch and cache the PinMeTo OAuth access token for 59 minutes.
    Sets the token in os.environ["PMT_ACCESS_TOKEN"].
    Returns the token string.
    """
    global _cached_token, _cached_token_time
    now = time.time()
    if _cached_token and (now - _cached_token_time) < _TOKEN_CACHE_SECONDS:
        return _cached_token
    token = asyncio.run(_fetch_and_store_token())
    _cached_token = token
    _cached_token_time = now
    return token


async def get_pmt_access_token_async() -> str:
    """
    Fetch and cache the PinMeTo OAuth access token for 59 minutes.
    Sets the token in os.environ["PMT_ACCESS_TOKEN"].
    Returns the token string.
    """
    global _cached_token, _cached_token_time
    now = time.time()
    if _cached_token and (now - _cached_token_time) < _TOKEN_CACHE_SECONDS:
        return _cached_token
    token = await _fetch_and_store_token()
    _cached_token = token
    _cached_token_time = now
    return token


async def _fetch_and_store_token():
    token_url = f"{os.environ.get("PINMETO_API_URL")}/oauth/token"
    app_id = os.environ.get("PINMETO_APP_ID")
    app_secret = os.environ.get("PINMETO_APP_SECRET")

    if not token_url or not app_id or not app_secret:
        logging.error("Environment variables not set properly. Exiting...")
        raise EnvironmentError(
            "PMT_TOKEN_URL, PINMETO_APP_ID, or PINMETO_APP_SECRET not set in environment."
        )

    # Prepare Basic Auth header
    credentials = f"{app_id}:{app_secret}"
    b64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {
        "Authorization": f"Basic {b64_credentials}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {"grant_type": "client_credentials"}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            headers=headers,
            data=data,
            timeout=30.0,
        )
        response.raise_for_status()
        resp_data = response.json()
        token = resp_data.get("access_token")
        if not token:
            raise KeyError("No access_token in response.")
        os.environ["PMT_ACCESS_TOKEN"] = token
        return token
