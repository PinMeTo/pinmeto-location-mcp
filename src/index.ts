import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp_server.js";
import { RemoteMcpServer } from "./remote_server.js";

let isRemote = false;
// Get args from command line
const args = process.argv;
if (args.length > 2 && args[2] === "remote") {
  isRemote = true;
}

const server = createMcpServer();
if (isRemote) {
  const port = 3000;
  const remoteServer = new RemoteMcpServer(server);
  remoteServer.start(port, (error) => {
    if (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }

    // Handle server shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down PinMeTo MCP Remote Server...");
      process.exit(0);
    });
    console.log(`PinMeTo MCP Remote Server listening on port ${port}`);
  });
} else {
  // STDIO
  const transport = new StdioServerTransport();
  server
    .connect(transport)
    .then(() => {
      console.error("PinMeTo MCP running on stdio");
    })
    .catch((error) => {
      console.error("Fatal error in main():", error);
      process.exit(1);
    });
}
