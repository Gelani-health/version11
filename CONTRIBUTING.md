# Contributing to Gelani AI Healthcare Assistant

First off, thank you for considering contributing to this project! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-healthcare-bahmni.git
   cd ai-healthcare-bahmni
   ```
3. Install dependencies:
   ```bash
   bun install
   # or
   npm install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
5. Start the development server:
   ```bash
   bun run dev
   ```

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL (production) or SQLite (development)
- Git

### IDE Setup

We recommend using VS Code with the following extensions:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Hero

## Making Changes

### Branch Naming

Create a branch with a descriptive name:

- `feature/add-new-ai-model` - New features
- `fix/drug-interaction-bug` - Bug fixes
- `docs/api-documentation` - Documentation changes
- `refactor/patient-component` - Code refactoring

### Making Changes

1. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run linting:
   ```bash
   bun run lint
   ```

4. Commit your changes:
   ```bash
   git commit -m "feat: add new AI model support"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use Zod for runtime validation

### React Components

- Use functional components with hooks
- Follow the component structure:
  ```tsx
  "use client"; // if client-side
  
  import { Component } from "library";
  
  interface Props {
    // props definition
  }
  
  export function MyComponent({ prop }: Props) {
    // component logic
    return (
      // JSX
    );
  }
  ```

### Styling

- Use Tailwind CSS classes
- Follow mobile-first responsive design
- Use shadcn/ui components when available

### API Routes

- Use proper HTTP methods
- Return consistent JSON responses
- Handle errors gracefully
- Include proper TypeScript types

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add support for MedGemma AI model
fix: resolve drug interaction false positive
docs: update API documentation
refactor: improve patient search performance
```

## Pull Request Process

1. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Fill in the PR template

2. **PR Requirements**
   - Link to any related issues
   - Describe the changes made
   - Include screenshots for UI changes
   - Update documentation if needed

3. **Review Process**
   - Wait for code review
   - Address review comments
   - Ensure CI checks pass

4. **Merge**
   - PR needs at least one approval
   - Squash and merge preferred

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

## Questions?

Feel free to open an issue for any questions or discussions!

---

Thank you for contributing! 🙏
