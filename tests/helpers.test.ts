import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { makePmtRequest, makePaginatedPmtRequest, formatListResponse } from "../src/helpers";

const mockToken = "mock_token_123"
const mockUrl = "https://api.example.com/locations"
const mockedAxiosGet = vi.mocked(axios.get);

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../src/token", () => ({
  getPmtAccessTokenAsync: vi.fn().mockResolvedValue("mock_token_123"),
}));


describe("Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should make PMT request with correct headers and return data", async () => {
    const mockData = {id: 1, name: "Test Location"}
    const mockResponse = {
      data: mockData,
    };
    mockedAxiosGet.mockResolvedValueOnce(mockResponse);

    const result = await makePmtRequest(mockUrl);

    expect(result).toEqual(mockData);
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      mockUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          authorization: `Bearer ${mockToken}`,
        }),
        timeout: 30000,
      })
    );
  });

  it("should handle paginated requests and format responses", async () => {
    const page2Url = "https://api.example.com/page2"
    const page1Response = {
      data: [{ id: 1 }, { id: 2 }],
      paging: { nextUrl: page2Url },
    };
    const page2Response = {
      data: [{ id: 3 }],
      paging: {},
    };
    
    mockedAxiosGet
      .mockResolvedValueOnce({ data: page1Response })
      .mockResolvedValueOnce({ data: page2Response });

    const [allData, areAllPagesFetched] = await makePaginatedPmtRequest(mockUrl);

    expect(allData).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(areAllPagesFetched).toBe(true);
    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);

    const formatted = formatListResponse(allData, areAllPagesFetched);
    expect(formatted).toContain('"id": 1');
    expect(formatted).toContain('"id": 2');
    expect(formatted).toContain('"id": 3');
    expect(formatted).not.toContain("Not All pages were successfully fetched");
  });
});
