import express, { Request, Response, Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

export class RemoteMcpServer {
  private mcpServer: McpServer;
  private transports: { [sessionId: string]: StreamableHTTPServerTransport };
  private expressApp: Express;

  constructor(mcpServer: McpServer) {
    this.mcpServer = mcpServer;
    this.transports = {};

    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req: Request, res: Response) => {
      console.log("Received MCP request:", req.body);
      try {
        // Check for existing session ID
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports[sessionId]) {
          // Reuse existing transport
          transport = this.transports[sessionId];
        } else if (req.body["method"] == "initialize") {
          // New initialization request - use JSON response mode
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true, // Enable JSON response mode
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID when session is initialized
              // This avoids race conditions where requests might come in before the session is stored
              console.log(`Session initialized with ID: ${sessionId}`);
              this.transports[sessionId] = transport;
            },
          });

          // Connect the transport to the MCP server BEFORE handling the request
          await this.mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return; // Already handled
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided",
            },
            id: null,
          });
          return;
        }

        // Handle the request with existing transport - no need to reconnect
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    // Handle GET requests for SSE streams according to spec
    app.get("/mcp", async (req: Request, res: Response) => {
      res.status(405).set("Allow", "POST").send("Method Not Allowed");
    });

    this.expressApp = app;
  }

  public start(port: number, callback: (error: Error | undefined) => void) {
    this.expressApp.listen(port, callback);
  }
}
