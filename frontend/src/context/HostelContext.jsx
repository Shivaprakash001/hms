import React, { createContext, useContext, useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ownerService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

const HostelContext = createContext(null);

const operationalSegments = new Set(['dashboard', 'rooms', 'tenants', 'payments', 'expenses', 'activities', 'activity']);

function normalizeHostels(response) {
  return Array.isArray(response) ? response : (response?.hostels || []);
}

function firstActiveHostel(response) {
  const hostels = normalizeHostels(response);
  return hostels.find((hostel) => hostel?.is_active !== false) || hostels[0] || null;
}

export function toHostelPath(hostelId, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const current = parts[0] === 'dashboard' && parts.length > 2 ? parts[2] : parts[1];
  const section = operationalSegments.has(current) ? (current === 'activity' ? 'activities' : current) : 'overview';
  const rest = parts[0] === 'dashboard' && parts.length > 2 ? parts.slice(3) : parts.slice(2);
  return `/dashboard/${hostelId}/${[section, ...rest].filter(Boolean).join('/')}`;
}

export function LegacyOwnerOperationalRedirect() {
  const location = useLocation();
  const { data: hostels = [], isLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const firstHostel = firstActiveHostel(hostels);
  if (isLoading) return null;
  if (!firstHostel?.id) return <Navigate to="/onboarding/hostel" replace />;
  return <Navigate to={toHostelPath(firstHostel.id, location.pathname)} replace />;
}

export function HostelContextProvider({ children }) {
  const { hostelId } = useParams();
  const location = useLocation();
  const { data: hostels = [], isLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const activeHostel = useMemo(
    () => normalizeHostels(hostels).find((hostel) => hostel.id === hostelId && hostel.is_active !== false) || null,
    [hostels, hostelId],
  );

  const value = useMemo(() => ({
    hostelId,
    activeHostel,
    hostels: normalizeHostels(hostels),
    buildHostelPath: (nextHostelId, pathname = location.pathname) => toHostelPath(nextHostelId, pathname),
  }), [activeHostel, hostelId, hostels, location.pathname]);

  if (!hostelId) return <LegacyOwnerOperationalRedirect />;
  if (isLoading) return null;
  if (!activeHostel) return <Navigate to="/dashboard" replace />;

  return <HostelContext.Provider value={value}>{children}</HostelContext.Provider>;
}

export function useHostelContext() {
  const context = useContext(HostelContext);
  if (!context?.hostelId) {
    throw new Error('HostelContextProvider is required for operational pages');
  }
  return context;
}

export function useOptionalHostelContext() {
  return useContext(HostelContext);
}
