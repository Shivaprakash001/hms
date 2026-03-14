# 🏗️ Frontend Architecture Guide

This document describes the improved architecture of the HMS frontend application.

## 🏛️ Core Principles

1.  **Separation of Concerns**: UI components handle rendering, while custom hooks handle logic and data fetching.
2.  **Server State Management**: use TanStack Query for caching, synchronizing, and updating server state.
3.  **Component Reusability**: Build a library of flexible UI components.
4.  **Smart/Presentational Pattern**: High-level "Smart" components handle data, while "Presentational" components focus on visual representation.

## 📁 Directory Structure

- `src/api`: Axios configuration and service definitions.
- `src/components/ui`: Low-level, reusable UI atoms (Button, Input, etc.).
- `src/components/shared`: Reusable business components (ErrorBoundary, Table, etc.).
- `src/hooks`: Custom hooks for all business logic and data fetching.
- `src/config`: Global configuration files (queryClient, etc.).
- `src/pages`: Top-level page components.
- `src/layouts`: Application layout components.

## 🔄 State Management

### Server State (API Data)
Managed by **TanStack Query**.
- **Caching**: Automatic caching of API responses.
- **Stale-while-revalidate**: Background refetching to keep data fresh.
- **Loading/Error States**: Built-in handling for query lifecycle.

### Client State
Managed by **React Hooks** and **Context API**.
- Use `useState` for simple local state.
- Use `useContext` (via `AuthProvider`) for global authentication state.

## 🚀 Performance Optimizations

1.  **Stale Time**: Configured default `staleTime` of 5 minutes to reduce unnecessary API calls.
2.  **Debouncing**: Use `useDebounce` hook for search and frequent input changes.
3.  **Code Splitting**: Use `React.lazy` for route-based loading.
