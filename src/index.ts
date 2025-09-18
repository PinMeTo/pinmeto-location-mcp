import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp_server.js";

async function main() {
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  console.error("PinMeTo MCP running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
