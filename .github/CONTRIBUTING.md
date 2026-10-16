# Contributing to Sonaria

Thank you for your interest in contributing to Sonaria! This document provides guidelines and
instructions for contributing to the project.

## 📝 Issues

- The issue tracker is for bug reports only.
- Before creating an issue, please check the
  [FAQ](https://github.com/iFluxo/Sonaria/wiki/Frequently-Asked-Questions) and existing issues (both
  open and closed).

## 🛠️ Pull Requests

We welcome contributions via pull requests! Please follow these guidelines:

1. **Fork the repository** and create a new branch from `main` for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Make your changes**, ensuring they align with the project's goals and coding style.

4. **Run checks:** Before submitting, ensure your code passes the following checks:

   ```bash
   bun run lint   # Lint and format check
   bun run type   # Type check
   bun run test   # Run tests
   bun run build  # Build JS + declarations
   ```

5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/). The commit message
   hook validates the message with commitlint.

   ```bash
   git commit -m "feat(Queue): add support for crossfade"
   ```

6. **Open a pull request** against the `main` branch of the Sonaria repository.

### Pull Request Guidelines

- Keep pull requests focused on a single issue or feature.
- Include relevant tests for your changes.
- Update documentation (if applicable).
- Follow the project's existing code style.
- Ensure all tests pass before submitting.
- Link any related issues in the pull request description.

## ⚙️ Development Setup

Sonaria is written in TypeScript and uses the following tools:

- [Bun](https://bun.sh/): Package manager, runtime and test runner (`bun test`)
- [Biome](https://biomejs.dev/): Linter and formatter
- [Seyfert](https://seyfert.dev/): Discord framework (peer dependency)

### Quick Commands

```bash
bun install           # Install dependencies
bun run build         # Build JS + type declarations into dist/
bun run test          # Run tests
bun run test:coverage # Run tests with coverage
bun run lint          # Check linting and formatting
bun run lint:fix      # Fix linting issues
bun run format        # Format code
bun run type          # Type check
```

See [CLAUDE.md](CLAUDE.md) for a detailed description of the architecture and conventions.

## ⚖️ License

By contributing to Sonaria, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
