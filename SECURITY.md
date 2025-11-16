# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of HUMMBL MCP Server seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue
- Post about it in public forums or social media
- Attempt to exploit the vulnerability beyond the minimum required for proof of concept

### Please DO:

**Report security vulnerabilities to: security@hummbl.io**

Please include the following information in your report:

- Type of vulnerability (e.g., input validation, authentication bypass, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect:

1. **Initial Response**: We will acknowledge your email within 48 hours
2. **Investigation**: We will investigate the issue and determine its severity
3. **Resolution**: We will develop and test a fix
4. **Disclosure**: We will coordinate public disclosure with you
5. **Credit**: We will credit you in our security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using HUMMBL MCP Server:

### Input Validation

- The server validates all inputs using Zod schemas
- Problem descriptions are sanitized before processing
- Model codes are validated against regex patterns

### Dependencies

- We use minimal dependencies (only @modelcontextprotocol/sdk and zod)
- Dependencies are regularly updated via Dependabot
- All dependencies are scanned for known vulnerabilities

### Runtime Security

- The server runs with minimal privileges
- No file system access beyond read-only configuration
- No network connections except MCP protocol communication
- All errors are logged without exposing sensitive information

### Integration Security

When integrating HUMMBL MCP Server:

1. **Authentication**: Use Claude Desktop's built-in authentication
2. **Network**: Run on localhost only (default)
3. **Permissions**: Grant minimal required permissions
4. **Monitoring**: Enable logging to detect unusual activity
5. **Updates**: Keep the server updated to the latest version

## Known Security Considerations

### Input Sanitization

- Problem descriptions accept arbitrary text input
- Current implementation has basic length validation
- Future versions will include enhanced content filtering

### Rate Limiting

- No rate limiting is implemented at the server level
- Claude Desktop provides rate limiting at the client level
- Consider implementing additional rate limiting for production deployments

### Audit Logging

- Server logs to stderr for MCP protocol compliance
- No persistent audit logs are maintained
- Consider external log aggregation for compliance requirements

## Security Updates

Security updates will be released as:

- **Critical**: Immediate patch release (within 24 hours)
- **High**: Patch release within 7 days
- **Medium**: Patch release within 30 days
- **Low**: Included in next regular release

Subscribe to our [GitHub releases](https://github.com/hummbl-dev/mcp-server/releases) to receive security notifications.

## Responsible Disclosure

We practice responsible disclosure:

1. Security fixes are developed privately
2. Coordinated disclosure with reporters
3. Public security advisories published with fixes
4. CVE IDs assigned for critical vulnerabilities

## Contact

- **Security Issues**: security@hummbl.io
- **General Questions**: reuben@hummbl.io
- **GitHub Issues**: [hummbl-dev/mcp-server/issues](https://github.com/hummbl-dev/mcp-server/issues) (non-security only)

Thank you for helping keep HUMMBL MCP Server and its users safe!
