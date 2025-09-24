import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp_server.js';

class McpServerTransport extends StdioServerTransport {
  onerror = (error: Error) => {
    console.error('MCP error', error);
  };
}

const server = createMcpServer();

const transport = new McpServerTransport();

server
  .connect(transport)
  .then(() => {
    console.error('PinMeTo MCP running on stdio');
  })
  .catch(error => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
