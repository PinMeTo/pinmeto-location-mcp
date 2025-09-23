import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp_server.js';

let isRemote = false;
// Get args from command line
const args = process.argv;
if (args.length > 2 && args[2] === 'remote') {
  isRemote = true;
}

// Store client info globally
export let clientInfo: any = { name: 'Unknown' };

const server = createMcpServer();

// Try to override the initialization to capture client info
const originalConnect = server.connect.bind(server);
server.connect = function (transport) {
  const result = originalConnect(transport);

  // Listen for initialization messages on the transport
  if (transport && (transport as any).onMessage) {
    const originalOnMessage = (transport as any).onMessage.bind(transport);
    (transport as any).onMessage = function (message: any) {
      if (message.method === 'initialize' && message.params?.clientInfo) {
        clientInfo = message.params.clientInfo;
        console.error('Client info captured:', clientInfo);
      }
      return originalOnMessage(message);
    };
  }

  return result;
};

const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {
    console.error('PinMeTo MCP running on stdio');
    console.error('Current client info:', clientInfo);
  })
  .catch(error => {
    console.error('Fatal error in index.ts', error);
    process.exit(1);
  });
