# Troubleshooting Guide

Common issues and solutions for HUMMBL MCP Server.

## Installation Issues

### npm install fails

**Problem**: `npm install` returns errors

**Solutions**:
1. Check Node.js version: `node --version` (must be >= 18.0.0)
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then reinstall
4. Use specific registry: `npm install --registry=https://registry.npmjs.org`

### Permission errors on install

**Problem**: EACCES or permission denied errors

**Solutions**:
1. Don't use sudo with npm
2. Configure npm to use a different directory:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

## Claude Desktop Integration

### Server not appearing in Claude

**Problem**: HUMMBL tools don't show in Claude Desktop

**Solutions**:
1. Check configuration file location:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Verify configuration format:
   ```json
   {
     "mcpServers": {
       "hummbl": {
         "command": "npx",
         "args": ["-y", "@hummbl/mcp-server"]
       }
     }
   }
   ```

3. Restart Claude Desktop completely (quit and reopen)

4. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### Server starts but no tools available

**Problem**: Server connects but tools don't appear

**Solutions**:
1. Check server version: `npx @hummbl/mcp-server --version`
2. Update to latest: `npm install -g @hummbl/mcp-server@latest`
3. Clear npx cache: `npx clear-npx-cache`
4. Check stdio communication (server should log to stderr)

### Tools are slow to respond

**Problem**: Long delays when using tools

**Solutions**:
1. Check network connectivity
2. Verify npx is using cached version (not downloading each time)
3. Install globally for better performance:
   ```bash
   npm install -g @hummbl/mcp-server
   ```
4. Update config to use global install:
   ```json
   {
     "command": "hummbl-mcp"
   }
   ```

## Runtime Issues

### Model not found errors

**Problem**: `Model code 'XX' not found`

**Solutions**:
1. Verify code format: Must be [P|IN|CO|DE|RE|SY][1-20]
2. Check case sensitivity: Use uppercase (P1, not p1)
3. Valid examples: P1, IN5, CO10, DE15, RE20, SY3

### Search returns no results

**Problem**: `search_models` returns empty array

**Solutions**:
1. Check query length (minimum 2 characters)
2. Try broader search terms
3. Search is case-insensitive
4. Searches across code, name, and definition fields

### Transformation not found

**Problem**: `Transformation 'X' not found`

**Solutions**:
1. Valid transformation keys: P, IN, CO, DE, RE, SY
2. Use uppercase
3. Example: `get_transformation` with key "P"

## Development Issues

### Tests failing

**Problem**: `npm test` shows failing tests

**Solutions**:
1. Install dependencies: `npm install`
2. Build project: `npm run build`
3. Check Node version matches CI (18, 20, or 22)
4. Run specific test: `npm test -- framework.test.ts`

### Type errors

**Problem**: TypeScript compilation errors

**Solutions**:
1. Check TypeScript version: `npx tsc --version`
2. Clean build: `npm run clean && npm run build`
3. Update dependencies: `npm update`
4. Check `tsconfig.json` matches project settings

### ESLint errors

**Problem**: Linting fails with errors

**Solutions**:
1. Auto-fix issues: `npm run lint:fix`
2. Check ESLint config: `eslint.config.js`
3. Ignore specific rules if needed (document why)
4. Run on specific file: `npx eslint src/file.ts`

### Coverage below threshold

**Problem**: Tests pass but coverage too low

**Solutions**:
1. Run coverage report: `npm run test:coverage`
2. Check uncovered lines in HTML report: `coverage/index.html`
3. Add tests for uncovered code
4. Adjust thresholds in `vitest.config.ts` if reasonable

## Performance Issues

### Memory usage high

**Problem**: Server uses excessive memory

**Solutions**:
1. Check Node.js memory limit
2. Monitor with: `node --inspect dist/index.js`
3. Profile with Chrome DevTools
4. Report issue with memory snapshot

### Slow startup time

**Problem**: Server takes long to start

**Solutions**:
1. Use global install instead of npx
2. Pre-build: `npm run build` before running
3. Check disk I/O performance
4. Verify no unnecessary imports in entry point

## Common Error Messages

### `ECONNREFUSED` or connection errors

**Cause**: Network or stdio communication issue

**Fix**: 
- Server should not make network connections
- Check Claude Desktop stdio connection
- Restart Claude Desktop

### `Cannot find module` errors

**Cause**: Missing dependencies or incorrect paths

**Fix**:
- Run `npm install`
- Check imports use `.js` extension (ESM)
- Verify `package.json` "type": "module"

### `Unexpected token` errors

**Cause**: Syntax error or wrong Node version

**Fix**:
- Check Node.js version >= 18
- Verify TypeScript compilation: `npm run build`
- Check for async/await usage (Node 18+ supports top-level await)

### Rate limit errors

**Cause**: Too many requests in time window

**Fix**:
- Wait 60 seconds and retry
- Current limit: 100 requests/minute per tool
- Contact support for higher limits

## Getting Help

If issues persist:

1. **Check GitHub Issues**: [github.com/hummbl-dev/mcp-server/issues](https://github.com/hummbl-dev/mcp-server/issues)

2. **Create New Issue** with:
   - Node.js version: `node --version`
   - npm version: `npm --version`
   - OS and version
   - Server version: `npx @hummbl/mcp-server --version`
   - Full error message
   - Steps to reproduce

3. **Email Support**: reuben@hummbl.io

4. **Claude Desktop Logs**: Include relevant log entries

## Debug Mode

Enable verbose logging:

```bash
# Set environment variable
export DEBUG=hummbl:*

# Run server
npm run dev
```

Check stderr output for detailed logs.

## Health Check

Verify server health:

```bash
# Build and run
npm run build
npm start

# Should see:
# HUMMBL MCP Server v1.0.0-beta.2 running on stdio
# Ready to serve mental models via Model Context Protocol
```

## Version Compatibility

| Server Version | MCP SDK | Node.js | Claude Desktop |
|---------------|---------|---------|----------------|
| 1.0.0-beta.2  | 1.0.4   | 18-22   | Latest         |
| 1.0.0-beta.1  | 1.0.4   | 18-22   | Latest         |

Always use latest versions for best compatibility.
