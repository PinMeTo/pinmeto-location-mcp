import axios from 'axios';
import dotenv from 'dotenv';
import packageJson from '../package.json';

dotenv.config();

let cachedToken: string | null = null;
let cachedTokenTime = 0;
const TOKEN_CACHE_SECONDS = 59 * 60;

export function getPmtAccessToken(): Promise<string> {
  // Synchronous wrapper for async token fetch
  return getPmtAccessTokenAsync();
}

export async function getPmtAccessTokenAsync(): Promise<string> {
  const now = Date.now() / 1000;
  if (cachedToken && now - cachedTokenTime < TOKEN_CACHE_SECONDS) {
    return cachedToken;
  }
  const token = await fetchAndStoreToken();
  cachedToken = token;
  cachedTokenTime = now;
  return token;
}

export async function fetchAndStoreToken(): Promise<string> {
  const tokenUrl = `${process.env.PINMETO_API_URL}/oauth/token`;
  const appId = process.env.PINMETO_APP_ID;
  const appSecret = process.env.PINMETO_APP_SECRET;

  if (!tokenUrl || !appId || !appSecret) {
    throw new Error(
      'PINMETO_API_URL, PINMETO_APP_ID, or PINMETO_APP_SECRET not set in environment.'
    );
  }

  // Prepare Basic Auth header
  const credentials = `${appId}:${appSecret}`;
  const b64Credentials = Buffer.from(credentials).toString('base64');
  const headers = {
    Authorization: `Basic ${b64Credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const data = new URLSearchParams({ grant_type: 'client_credentials' });

  const response = await axios.post(tokenUrl, data, {
    headers,
    timeout: 30000
  });
  const respData = response.data;
  const token = respData['access_token'];
  if (!token) {
    throw new Error('No access_token in response.');
  }
  process.env.PMT_ACCESS_TOKEN = token;
  return token;
}
