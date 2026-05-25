import type { PropsWithChildren } from 'react';
import { RootProviders } from './RootProviders';
import { ProtectedAppProviders } from './ProtectedAppProviders';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <RootProviders>
      <ProtectedAppProviders>{children}</ProtectedAppProviders>
    </RootProviders>
  );
}
