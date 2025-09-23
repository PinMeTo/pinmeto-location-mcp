import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePaginatedPmtRequest, formatListResponse } from "../src/helpers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLocations } from "../src/tools/locations/locations";

vi.mock("../src/helpers", () => ({
  makePaginatedPmtRequest: vi.fn(),
}));

vi.mock("../utils/formatListResponse", () => ({
  formatListResponse: vi.fn(),
}));

const mockToolFn = vi.fn();
const fakeServer = {
  tool: mockToolFn,
} as unknown as McpServer;

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.PINMETO_API_URL;
  delete process.env.PINMETO_ACCOUNT_ID;
});

it("registers get_locations tool with expected name and description", () => {
  getLocations(fakeServer);
  expect(mockToolFn).toHaveBeenCalledWith(
    "get_locations",
    expect.stringContaining("Get all location details"),
    {},
    expect.any(Function)
  );
});

it("returns error content when env vars are missing", async () => {
  getLocations(fakeServer);
  const toolCall = mockToolFn.mock.calls[0][3]; // the tool handler fn
  const result = await toolCall();
  expect(result.content[0].text).toMatch(/Missing PINMETO_API_URL/);
});

it("returns error when data is empty", async () => {
  process.env.PINMETO_API_URL = "https://api.pinmeto.com";
  process.env.PINMETO_ACCOUNT_ID = "abc123";
  (makePaginatedPmtRequest as any).mockResolvedValue([[], true]);

  getLocations(fakeServer);
  const handler = mockToolFn.mock.calls[0][3];
  const result = await handler();
  expect(result.content[0].text).toMatch(/Unable to fetch location data/);
});
