#!/usr/bin/env node

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './mcp_server.js';

serveStdio(() => createMcpServer(), {
  onerror(error) {
    console.error('Fatal error in main():', error);
  }
});

console.error('PinMeTo MCP running on stdio');
