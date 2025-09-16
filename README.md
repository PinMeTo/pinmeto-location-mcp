# PinMeTo MCP Server

## Installation

Requirements: Python 3.13

You need to have uv installed for Claude to run your MCP:

- Install uv by running the command:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

- Install the dependencies

```bash
uv venv
source .venv/bin/activate
uv pip install .
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
        "pinmeto": {
            "command": "{PATH-TO-UV}/uv",
            "args": [
                "--directory",
                "{PATH-TO-REPO}/pinmeto-mcp-spike",
                "run",
                "main.py"
            ]
        }
    }
}
```

- Restart Claude, make sure Claude desktop has all permissions it needs and you will be able to see the PinMeTo MCP in your MCP selection.
