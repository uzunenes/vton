> ## Documentation Index
> Fetch the complete documentation index at: https://docs.fal.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Connect fal to Cursor

> Access complete fal documentation in your IDE with Model Context Protocol

## Connect fal to Cursor with MCP

The Model Context Protocol (MCP) enables Cursor to access the entire fal documentation and fal.ai website directly within your IDE. This supercharges your development workflow and makes migration seamless by giving you instant access to:

* **Complete documentation** - Browse all fal docs without leaving your IDE
* **API references** - Get real-time information about models, endpoints, and parameters
* **Code examples** - Access working code snippets and best practices instantly
* **Contextual assistance** - AI-powered suggestions based on fal's complete knowledge base

Follow these simple steps to get started:

### Step 1: Open Command Palette

On Cursor, use `Cmd+Shift+P` (`Ctrl+Shift+P` on Windows) to open up the command palette.

### Step 2: Search for MCP Settings

Search for "Open MCP settings".

### Step 3: Add Custom MCP

Select **Add custom MCP**. This will open the `mcp.json` file.

### Step 4: Configure fal Server

In `mcp.json`, add the following configuration:

```json  theme={null}
{
  "mcpServers": {
    "fal": {
      "url": "https://docs.fal.ai/mcp"
    }
  }
}
```

That's it! Save the file and restart Cursor. You now have the complete fal ecosystem at your fingertips.

## What You Can Do With MCP

Once connected, Cursor can:

* **Answer questions** about any fal model, API, or feature using the complete documentation
* **Generate code** with context from fal's entire knowledge base
* **Debug faster** with instant access to error explanations and solutions
* **Migrate seamlessly** from other platforms with contextual guidance
* **Discover features** you didn't know existed through intelligent suggestions

## What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs. By connecting Cursor to fal via MCP, you're giving your AI assistant complete access to fal's documentation and resources, making it an expert in all things fal.

## Need Help?

If you encounter any issues or have questions, please visit our [support page](/model-apis/support) or join our [Discord community](https://discord.gg/fal-ai).
