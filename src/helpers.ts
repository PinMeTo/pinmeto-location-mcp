import axios from "axios";
import { getPmtAccessTokenAsync } from "./token";

export async function makePmtRequest(
  url: string,
  from?: string,
  to?: string
): Promise<Record<string, any> | null> {
  const token = await getPmtAccessTokenAsync();
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
  };

  try {
    const response = await axios.get(url, { headers, timeout: 30000 });
    return response.data;
  } catch (e: any) {
    console.error(`Request failed, reason: ${e}`);
    return null;
  }
}

export async function makePaginatedPmtRequest(
  url: string
): Promise<[any[], boolean]> {
  const allData: any[] = [];
  let nextUrl: string | undefined = url;
  let areAllPagesFetched = true;

  while (nextUrl) {
    const resp = await makePmtRequest(nextUrl);
    if (!resp) {
      console.warn("Couldn't fetch all pages for the request");
      areAllPagesFetched = false;
      break;
    }
    const pageData: any[] = resp["data"] || [];
    allData.push(...pageData);
    const paging = resp["paging"] || {};
    nextUrl = paging["nextUrl"];
    if (!nextUrl) break;
  }
  return [allData, areAllPagesFetched];
}

export function formatListResponse(
  response: any[],
  areAllPagesFetched: boolean
): string {
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
