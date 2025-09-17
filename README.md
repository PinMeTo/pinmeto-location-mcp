# PinMeTo MCP Server

## Installation

Requirements: Node, V22>

It's preferred to use NVM to install your node version, to run your MCP:

- Install the dependencies, and build teh project

```bash
npm install
npm run build
```

- Create an `.env` file in this folder and put the following keys in it:

```txt
PINMETO_API_URL = "https://api.pinmeto.com"
PINMETO_ACCOUNT_ID = "{Your Account ID}"
PINMETO_APP_SECRET = "{Your App Secret}"
PINMETO_APP_ID = "{Your App ID}"
```

- Register the in your `claude_desktop_config.json`, if you have VSCode you can run `code ~/Library/Application\ Support/Claude/claude_desktop_config.json` on MacOS.

  You can get the `{PATH-TO-UV}` with `which uv`. Also always use absolute paths instead of relative paths

```json
{
    "mcpServers": {
        "PinMeTo-MCP": {
            "command": "{{path-to-node}}",
            "args": [
                "{{path-to-here}}/build/index.js"
            ],
            "env": {
                "PINMETO_API_URL": "",
                "PINMETO_ACCOUNT_ID": "",
                "PINMETO_APP_ID": "",
                "PINMETO_APP_SECRET": ""
            }
        }
    }
}

```

- Restart Claude, make sure Claude desktop has all permissions it needs and you will be able to see the PinMeTo MCP in your MCP selection.
