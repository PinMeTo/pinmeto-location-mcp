export interface Configs {
  apiBaseUrl: string;
  locationsApiBaseUrl: string;
  accountId: string;
  appId: string;
  appSecret: string;
  accessToken?: string;
  accessTokenTime: number;
}

export function getConfigs(): Configs {
  let apiBaseUrl = 'https://api.pinmeto.com';
  let locationsApiBaseUrl = 'https://locations.api.pinmeto.com';

  if (process.env.NODE_ENV === 'development' && process.env.PINMETO_API_URL) {
    apiBaseUrl = process.env.PINMETO_API_URL.trim().replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'development' && process.env.PINMETO_LOCATION_API_URL) {
    locationsApiBaseUrl = process.env.PINMETO_LOCATION_API_URL.trim().replace(/\/$/, '');
  }

  let accountId = process.env.PINMETO_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error('Missing configuration PINMETO_ACCOUNT_ID');
  }

  let appId = process.env.PINMETO_APP_ID?.trim();
  if (!appId) {
    throw new Error('Missing configuration PINMETO_APP_ID');
  }

  let appSecret = process.env.PINMETO_APP_SECRET?.trim() || '';
  if (!appSecret) {
    throw new Error('Missing configuration PINMETO_APP_SECRET');
  }

  return {
    apiBaseUrl,
    locationsApiBaseUrl,
    accountId,
    appId,
    appSecret,
    accessTokenTime: 0
  };
}
