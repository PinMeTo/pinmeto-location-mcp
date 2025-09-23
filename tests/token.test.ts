import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchAndStoreToken, getPmtAccessTokenAsync } from "../src/token";

// Mock axios
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedPost = vi.mocked(axios.post);

beforeEach(() => {
  process.env.PINMETO_API_URL = "https://api.example.com";
  process.env.PINMETO_APP_ID = "test_id";
  process.env.PINMETO_APP_SECRET = "test_secret";
  vi.clearAllMocks();
});

describe("Token Management", () => {
  it("should fetch token with correct headers and store in environment", async () => {
    const mockResponse = {
      data: { access_token: "test_token_123" },
    };
    mockedPost.mockResolvedValueOnce(mockResponse);

    const token = await fetchAndStoreToken();

    expect(token).toBe("test_token_123");
    expect(process.env.PMT_ACCESS_TOKEN).toBe("test_token_123");

    // Verify the API call was made correctly
    expect(mockedPost).toHaveBeenCalledWith(
      "https://api.example.com/oauth/token",
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Basic dGVzdF9pZDp0ZXN0X3NlY3JldA==", // base64 of test_id:test_secret
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        timeout: 30000,
      })
    );
  });

  it("should cache tokens to avoid unnecessary API calls", async () => {
    // Mock successful response
    const mockResponse = {
      data: { access_token: "cached_token" },
    };
    mockedPost.mockResolvedValue(mockResponse);

    // Make multiple calls
    const token1 = await getPmtAccessTokenAsync();
    const token2 = await getPmtAccessTokenAsync();
    const token3 = await getPmtAccessTokenAsync();

    // All should return same token
    expect(token1).toBe("cached_token");
    expect(token2).toBe("cached_token");
    expect(token3).toBe("cached_token");

    // But only make one API call due to caching
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
