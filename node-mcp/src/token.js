import fetch from "node-fetch";
import * as fs from "fs";

// Token caching variables
let cachedToken = null;
let cachedTokenTime = 0;
const TOKEN_CACHE_SECONDS = 59 * 60; // 59 minutes

/**
 * Fetch and cache the PinMeTo OAuth access token for 59 minutes.
 * Sets the token in process.env.PMT_ACCESS_TOKEN.
 * Returns the token string.
 */
export async function getPmtAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && now - cachedTokenTime < TOKEN_CACHE_SECONDS) {
    return cachedToken;
  }

  const token = await fetchAndStoreToken();
  cachedToken = token;
  cachedTokenTime = now;
  return token;
}

/**
 * Fetch token from PinMeTo OAuth endpoint
 */
async function fetchAndStoreToken() {
  const tokenUrl = `${process.env.PINMETO_API_URL}/oauth/token`;
  const appId = process.env.PINMETO_APP_ID;
  const appSecret = process.env.PINMETO_APP_SECRET;

  if (!tokenUrl || !appId || !appSecret) {
    console.error("Environment variables not set properly. Exiting...");
    throw new Error(
      "PINMETO_API_URL, PINMETO_APP_ID, or PINMETO_APP_SECRET not set in environment."
    );
  }

  // Prepare Basic Auth header
  const credentials = `${appId}:${appSecret}`;
  const b64Credentials = Buffer.from(credentials).toString("base64");

  const headers = {
    Authorization: `Basic ${b64Credentials}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const body = new URLSearchParams({
    grant_type: "client_credentials",
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: headers,
      body: body,
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const respData = await response.json();
    const token = respData.access_token;

    if (!token) {
      throw new Error("No access_token in response.");
    }

    process.env.PMT_ACCESS_TOKEN = token;
    return token;
  } catch (error) {
    console.error(`Token fetch failed: ${error.message}`);
    throw error;
  }
}
