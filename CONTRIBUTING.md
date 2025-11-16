# Contributing to HUMMBL MCP Server

Thank you for your interest in contributing to HUMMBL MCP Server! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/mcp-server.git
cd mcp-server
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up pre-commit hooks**

```bash
npm run prepare
```

4. **Run tests to verify setup**

```bash
npm test
```

## Development Workflow

### Running the Server Locally

```bash
# Development mode with auto-reload
npm run dev

# Production build
npm run build
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Interactive test UI
npm run test:ui
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Run all checks
npm run validate
```

## Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or updates
- `chore`: Build process or tooling changes

Examples:
```
feat(tools): add new search capability
fix(framework): correct model lookup logic
docs(readme): update installation instructions
```

### Code Style

- Use TypeScript for all code
- Follow the ESLint configuration
- Use Prettier for formatting
- Write tests for new features
- Maintain or improve code coverage

### Testing Guidelines

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test MCP tool interactions
3. **Coverage**: Maintain >= 80% coverage
4. **Test Structure**:
   ```typescript
   describe("Feature", () => {
     describe("method", () => {
       it("should do something", () => {
         // Test implementation
       });
     });
   });
   ```

## Pull Request Process

1. **Update your fork**

```bash
git remote add upstream https://github.com/hummbl-dev/mcp-server.git
git fetch upstream
git rebase upstream/main
```

2. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

3. **Make your changes**
   - Write code following style guidelines
   - Add tests for new functionality
   - Update documentation as needed

4. **Run validation**

```bash
npm run validate
```

5. **Commit your changes**

```bash
git add .
git commit -m "feat: add new feature"
```

6. **Push to your fork**

```bash
git push origin feature/your-feature-name
```

7. **Create Pull Request**
   - Go to GitHub and create a PR
   - Fill out the PR template
   - Link related issues
   - Request review from maintainers

### PR Requirements

- ✅ All tests pass
- ✅ Code coverage maintained or improved
- ✅ No linting errors
- ✅ Documentation updated
- ✅ Commit messages follow conventions
- ✅ PR description explains changes

## Adding New Features

### Adding a New Mental Model

1. Update `src/framework/base120.ts`
2. Add model to appropriate transformation
3. Write tests in `src/__tests__/framework.test.ts`
4. Update documentation

### Adding a New Tool

1. Create tool in `src/tools/`
2. Register in `src/server.ts`
3. Add Zod schemas for input/output
4. Write tests in `src/__tests__/tools.test.ts`
5. Update README with tool documentation

### Adding a New Resource

1. Create resource in `src/resources/`
2. Register in `src/server.ts`
3. Add URI template
4. Write tests
5. Update documentation

## Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include examples in comments
- Document parameters and return types

```typescript
/**
 * Retrieve a mental model by its code
 * @param code - Model code (e.g., "P1", "IN5")
 * @returns Mental model or null if not found
 * @example
 * const model = getModelByCode("P1");
 */
export function getModelByCode(code: string): MentalModel | null {
  // Implementation
}
```

### README Updates

- Keep installation instructions current
- Add examples for new features
- Update API documentation
- Maintain changelog

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email security concerns to: security@hummbl.io

See [SECURITY.md](./SECURITY.md) for full policy.

### Security Best Practices

- Validate all user inputs
- Sanitize text content
- Use Zod schemas for validation
- Follow principle of least privilege
- Keep dependencies updated

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions automatically publishes to npm

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/hummbl-dev/mcp-server/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/hummbl-dev/mcp-server/issues)
- **Email**: reuben@hummbl.io

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- CHANGELOG.md (for significant contributions)

Thank you for contributing to HUMMBL MCP Server! 🚀
