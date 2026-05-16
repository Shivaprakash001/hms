# Import Guidelines

This document outlines the standard path aliases and import conventions for the HMS project, aiming to eliminate deep relative imports (`../../../../`) and maintain architectural boundaries.

## Path Aliases

Both the frontend (`vite.config.js` / `jsconfig.json`) and backend (`tsconfig.json`) are configured to use identical structural aliases. 

| Alias | Target Directory | Usage |
| :--- | :--- | :--- |
| `@/` | `src/` (Root) | Fallback for root-level modules |
| `@components/` | `src/components/` | Reusable React UI / Global components |
| `@features/` | `src/features/` | Domain-driven modules (e.g., Tenants, Billing) |
| `@services/` | `src/services/` | Business logic & API clients |
| `@utils/` | `src/utils/` | Stateless pure helper functions |
| `@hooks/` | `src/hooks/` | Custom React Hooks |
| `@lib/` | `src/lib/` | Core wrappers (Prisma, Auth, Payments) |
| `@config/` | `src/config/` | Constants and Environment variable bindings |
| `@types/` | `src/types/` | TypeScript type declarations |

## Rules & Conventions

### 1. No Deep Relative Imports
**❌ Incorrect:**
```typescript
import { formatCurrency } from '../../../../utils/format';
import { Button } from '../../components/ui/Button';
```

**✅ Correct:**
```typescript
import { formatCurrency } from '@utils/format';
import { Button } from '@components/ui/Button';
```

### 2. Sibling/Child Relative Imports are Allowed
If importing a file within the *same* feature or directory, relative paths are acceptable and preferred.
**✅ Correct:**
```typescript
// Inside src/features/auth/components/LoginForm.jsx
import { useAuth } from '../hooks/useAuth'; 
```

### 3. Import Ordering
Organize your imports in the following cascading order, separated by an empty line:
1. Node.js built-ins / Framework imports (`react`, `next/server`)
2. Third-party packages (`zod`, `framer-motion`)
3. Global absolute aliases (`@config/`, `@lib/`)
4. Feature absolute aliases (`@features/`)
5. Relative sibling/child imports (`./styles.css`, `../utils`)

### 4. Boundary Protection
* Frontend components should **never** import from `backend-next`.
* Backend services should **never** import React components.
* A feature module (e.g., `@features/billing`) should expose a public API (e.g., `index.ts`) rather than having other modules deeply import its internals.
