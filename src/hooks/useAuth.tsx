import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Unit } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  unit: Unit | null;
  isLoading: boolean;
  isAdmin: boolean;
  isContabilidade: boolean;
  isGestorUnidade: boolean;
  isSecretaria: boolean;
  isFinanceiro: boolean;
  isContador: boolean;
  hasPermission: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile/role fetch
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setUnit(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile with unit
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      setProfile(profileData as Profile | null);

      // If profile has unit_id, fetch the unit
      if (profileData?.unit_id) {
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('id', profileData.unit_id)
          .single();
        
        setUnit(unitData as Unit | null);
      } else {
        setUnit(null);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      setRole(roleData?.role as AppRole | null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setUnit(null);
  };

  const isAdmin = role === 'admin';
  const isContabilidade = role === 'contabilidade';
  const isGestorUnidade = role === 'gestor_unidade';
  const isSecretaria = role === 'secretaria';
  const isFinanceiro = role === 'financeiro';
  const isContador = role === 'contador';

  // Verifica se o usuário tem acesso a uma determinada permissão
  const hasPermission = (permission: string): boolean => {
    if (isAdmin) return true; // Admin tem acesso total
    
    const permissions: Record<string, AppRole[]> = {
      'dashboard': ['admin', 'gestor_unidade', 'financeiro', 'contador'],
      'transactions': ['admin', 'secretaria', 'contabilidade', 'gestor_unidade', 'financeiro'],
      'cash_closing': ['admin', 'secretaria', 'gestor_unidade'],
      'imports': ['admin', 'secretaria', 'gestor_unidade', 'financeiro'],
      'reports': ['admin', 'contabilidade', 'gestor_unidade', 'contador'],
      'tax_scenarios': ['admin', 'contabilidade', 'contador'],
      'personnel_real_vs_official': ['admin'],
      'fator_r_audit': ['admin', 'contabilidade', 'contador'],
      'fiscal_base': ['admin', 'contador'],
      'tax_config': ['admin'],
      'users': ['admin'],
      'settings': ['admin'],
      'payables': ['admin', 'financeiro', 'contabilidade'],
      'billing': ['admin', 'financeiro', 'contabilidade'],
    };
    
    const allowedRoles = permissions[permission];
    if (!allowedRoles || !role) return false;
    return allowedRoles.includes(role);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      unit,
      isLoading,
      isAdmin,
      isContabilidade,
      isGestorUnidade,
      isSecretaria,
      isFinanceiro,
      isContador,
      hasPermission,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
