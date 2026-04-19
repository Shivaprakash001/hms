import { useAuth as useAuthContext } from '../context/AuthContext';

/**
 * Hook to access authentication state and methods
 */
export const useAuth = () => {
  const context = useAuthContext();
  const { user, loading, login, logout, register } = context;
  
  return {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
    isAdmin: user?.role?.toLowerCase() === 'admin',
    isWarden: user?.role?.toLowerCase() === 'warden',
    isStudent: user?.role?.toLowerCase() === 'student',
  };
};
