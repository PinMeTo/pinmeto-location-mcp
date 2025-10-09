#!/usr/bin/env node

import dotenv from 'dotenv';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp_server.js';

if (process.env.NODE_ENV === 'development') {
  dotenv.config({
    quiet: true
  });
}

const server = createMcpServer();

const transport = new StdioServerTransport();

server
  .connect(transport)
  .then(() => {
    console.error('PinMeTo MCP running on stdio');
  })
  .catch(error => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
