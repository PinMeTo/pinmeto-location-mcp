import fetch from "node-fetch";
import { getPmtAccessToken } from "./token.js";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

/**
 * Make an authenticated request to PinMeTo API
 * @param {string} url - The URL to request
 * @returns {Promise<Object|null>} - The response JSON or null if failed
 */
export async function makePmtRequest(url) {
  try {
    const token = await getPmtAccessToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Request failed, reason: ${error.message}`);
    return null;
  }
}

/**
 * Fetch all paginated results from a PinMeTo API endpoint.
 * Returns a tuple of [data_array, are_all_pages_fetched]
 * @param {string} url - The initial URL to request
 * @returns {Promise<[Array<any>, boolean]>} - Array of all items and success flag
 */
export async function makePaginatedPmtRequest(url) {
  const allData = [];
  let nextUrl = url;
  let areAllPagesFetched = true;

  while (nextUrl) {
    const resp = await makePmtRequest(nextUrl);
    if (!resp) {
      console.warn("Couldn't fetch all pages for the request");
      areAllPagesFetched = false;
      break;
    }

    const pageData = resp.data || [];
    allData.push(...pageData);

    const paging = resp.paging || {};
    nextUrl = paging.nextUrl;

    if (!nextUrl) {
      break;
    }
  }

  return [allData, areAllPagesFetched];
}

/**
 * Format a list response with separators and page fetch status
 * @param {Array<any>} response - The array of response items
 * @param {boolean} areAllPagesFetched - Whether all pages were successfully fetched
 * @returns {string} - Formatted response string
 */
export function formatListResponse(response, areAllPagesFetched) {
  if (response.length === 0) {
    return "The response was empty...";
  }

  let formattedMessage = "-".repeat(20);

  if (!areAllPagesFetched) {
    formattedMessage =
      "Not All pages were successfully fetched, collected data:\n" +
      formattedMessage;
  }

  for (const result of response) {
    formattedMessage +=
      "\n" + JSON.stringify(result, null, 2) + "\n" + "-".repeat(20);
  }

  return formattedMessage;
}
