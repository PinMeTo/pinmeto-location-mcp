import os
import logging
import helpers.helpers as Helpers
import helpers.token as Token
from mcp.server.fastmcp import FastMCP
from dotenv import find_dotenv, load_dotenv


mcp = FastMCP("pinmeto")

load_dotenv(find_dotenv())

global __PMT_API_URL, __ACCOUNT_ID


@mcp.tool()
async def get_location(store_id: str) -> str:
    """
    Get location details for a store from PinMeTo API.

    Args:
        store_id: The store ID to look up.
    """

    if not __PMT_API_URL or not __ACCOUNT_ID:
        return "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable."
    url = f"{__PMT_API_URL}/listings/v3/{__ACCOUNT_ID}/locations/{store_id}"
    data = await Helpers.make_pmt_request(url)
    if not data:
        return "Unable to fetch location data."

    return str(data)


@mcp.tool()
async def get_locations() -> str:
    """
    Get all location details for the site from PinMeTo API.
    You can use this endpoint to find store ids for locations, used in other calls.

    Args:
        -
    """

    if not __PMT_API_URL or not __ACCOUNT_ID:
        return "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable."
    url = f"{__PMT_API_URL}/listings/v3/{__ACCOUNT_ID}/locations?pagesize=100"
    (data, are_all_pages_fetched) = await Helpers.make_paginated_pmt_request(url)
    if not data:
        return "Unable to fetch location data."

    return Helpers.format_list_response(data, are_all_pages_fetched)


if __name__ == "__main__":
    logging.info("Starting the PinMeTo MCP server...")
    token = Token.get_pmt_access_token()

    __PMT_API_URL = os.environ.get("PINMETO_API_URL")
    __ACCOUNT_ID = os.environ.get("PINMETO_ACCOUNT_ID")

    mcp.run(transport="stdio")
