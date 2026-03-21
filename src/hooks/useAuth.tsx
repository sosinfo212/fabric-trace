import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authApi, setAuthToken, removeAuthToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  full_name?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: { token: string } | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const { user } = await authApi.verify();
            setUser(user);
            setSession({ token });
          } catch (verifyError: any) {
            // Only remove token if it's an authentication error (401, 403)
            // Don't log out on network errors (they might be temporary)
            if (verifyError.message?.includes('401') || 
                verifyError.message?.includes('403') ||
                verifyError.message?.includes('Unauthorized') ||
                verifyError.message?.includes('Token')) {
              removeAuthToken();
              setUser(null);
              setSession(null);
            } else {
              // Network error or other issue - keep token but don't set user
              console.warn('Session verification failed:', verifyError);
            }
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { user } = await authApi.signUp(email, password, fullName);
      setUser(user);
      const token = localStorage.getItem('auth_token');
      if (token) {
        setSession({ token });
      }
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user } = await authApi.signIn(email, password);
      setUser(user);
      const token = localStorage.getItem('auth_token');
      if (token) {
        setSession({ token });
      }
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
