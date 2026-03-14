# 🚀 Frontend Architecture - Implementation Guide

## 🛠 Prerequisites

Ensure the following dependencies are installed:
- `@tanstack/react-query`
- `clsx`
- `tailwind-merge`
- `framer-motion`

## 🏁 Implementation Steps

### 1. Setup
Initialize the `QueryClient` in `src/config/queryClient.js` and wrap your application in `QueryClientProvider` within `src/main.jsx`.

### 2. Transitioning to Hooks
Instead of calling API services directly inside components, create or use hooks from `src/hooks/`.

**Traditional Way (Avoid):**
```javascript
useEffect(() => {
  setIsLoading(true);
  studentService.getAll()
    .then(data => setStudents(data))
    .finally(() => setIsLoading(false));
}, []);
```

**Improved Way (Recommended):**
```javascript
const { data: students, isLoading } = useStudents();
```

### 3. Using Reusable Components
Use components from `src/components/ui/` to maintain visual consistency.

```javascript
import Button from '../components/ui/Button';

<Button variant="primary" size="lg" isLoading={isSubmitting}>
  Save Changes
</Button>
```

### 4. Error Handling
Ensure components are wrapped in Error Boundaries and use the global `handleApiError` utility for toast notifications.
