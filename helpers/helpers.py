import httpx
import helpers.token as Token
import logging
from typing import Any, List, Tuple

NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0"


async def make_pmt_request(url: str) -> dict[str, Any] | None:
    token = await Token.get_pmt_access_token_async()
    headers = {"Content-Type": "application/json", "authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logging.error(f"Request failed, reason: {e}")
            return None

    return formatted_message


async def make_paginated_pmt_request(url: str) -> Tuple[List[Any], bool]:
    """
    Fetch all paginated results from a PinMeTo API endpoint.
    Returns a list of all items from all pages.
    """
    all_data: List[Any] = []
    next_url = url
    are_all_pages_fetched = True

    while next_url:
        resp = await make_pmt_request(next_url)
        if not resp:
            logging.warning("Couldn't fetch all pages for the request")
            are_all_pages_fetched = False
            break

        page_data: List[Any] = resp.get("data", [])
        all_data.extend(page_data)
        paging = resp.get("paging", {})
        next_url = paging.get("nextUrl")

        if not next_url:
            break

    return (all_data, are_all_pages_fetched)


def format_list_response(response: List[Any], are_all_pages_fetched: bool) -> str:
    if response == []:
        return "The response was empty..."

    formatted_message: str = "-" * 20

    if not are_all_pages_fetched:
        formatted_message = (
            "Not All pages were successfully fetched, collected data:\n"
            + formatted_message
        )

    for result in response:
        formatted_message += "\n" + str(result) + "\n" + ("-" * 20)

    return formatted_message
