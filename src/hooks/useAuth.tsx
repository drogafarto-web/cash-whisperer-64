import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Unit } from '@/types/database';

// Types for profile units and functions
interface ProfileUnit {
  id: string;
  profile_id: string;
  unit_id: string;
  is_primary: boolean | null;
  unit?: Unit;
}

interface ProfileFunction {
  id: string;
  profile_id: string;
  function: string;
}

// Operational function types
export type OperationalFunction = 'atendimento' | 'coleta' | 'caixa' | 'supervisao' | 'tecnico';

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
  canAccessAllUnits: boolean;
  hasPermission: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // New: operational functions and multi-unit support
  userFunctions: OperationalFunction[];
  userUnits: ProfileUnit[];
  activeUnit: Unit | null;
  setActiveUnit: (unit: Unit) => void;
  hasCashFunction: boolean;
  hasFunction: (fn: OperationalFunction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for functions and multi-unit
  const [userFunctions, setUserFunctions] = useState<OperationalFunction[]>([]);
  const [userUnits, setUserUnits] = useState<ProfileUnit[]>([]);
  const [activeUnit, setActiveUnitState] = useState<Unit | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          resetState();
          setIsLoading(false);
        }
      }
    );

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

  const resetState = () => {
    setProfile(null);
    setRole(null);
    setUnit(null);
    setUserFunctions([]);
    setUserUnits([]);
    setActiveUnitState(null);
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Parallel fetch: profile, profile_units, profile_functions, user_roles
      const [profileResult, profileUnitsResult, functionsResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('profile_units').select(`
          id,
          profile_id,
          unit_id,
          is_primary,
          unit:units(*)
        `).eq('profile_id', userId),
        supabase.from('profile_functions').select('function').eq('profile_id', userId),
        supabase.from('user_roles').select('role').eq('user_id', userId).single()
      ]);

      const profileData = profileResult.data;
      setProfile(profileData as Profile | null);

      const mappedUnits: ProfileUnit[] = (profileUnitsResult.data || []).map(pu => ({
        id: pu.id,
        profile_id: pu.profile_id,
        unit_id: pu.unit_id,
        is_primary: pu.is_primary,
        unit: pu.unit as Unit | undefined,
      }));
      setUserUnits(mappedUnits);

      // Determine active unit: primary unit from profile_units, or fallback to profile.unit_id
      const primaryProfileUnit = mappedUnits.find(pu => pu.is_primary);
      let activeUnitData: Unit | null = null;

      if (primaryProfileUnit?.unit) {
        activeUnitData = primaryProfileUnit.unit;
      } else if (mappedUnits.length > 0 && mappedUnits[0].unit) {
        activeUnitData = mappedUnits[0].unit;
      } else if (profileData?.unit_id) {
        // Fallback to legacy unit_id (only additional query if needed)
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('id', profileData.unit_id)
          .single();
        activeUnitData = unitData as Unit | null;
      }

      setUnit(activeUnitData);
      setActiveUnitState(activeUnitData);

      const functions = (functionsResult.data || []).map(f => f.function as OperationalFunction);
      setUserFunctions(functions);

      setRole(roleResult.data?.role as AppRole | null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveUnit = useCallback((newUnit: Unit) => {
    setActiveUnitState(newUnit);
    setUnit(newUnit); // Keep legacy unit in sync
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (data?.user && !error) {
      supabase
        .from('profiles')
        .update({ last_access: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {});
    }
    
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
    resetState();
  };

  const isAdmin = role === 'admin';
  const isContabilidade = role === 'contabilidade';
  const isGestorUnidade = role === 'gestor_unidade';
  const isSecretaria = role === 'secretaria';
  const isFinanceiro = role === 'financeiro';
  const isContador = role === 'contador';
  
  const canAccessAllUnits = isAdmin || isContabilidade || isFinanceiro || isContador;

  // Check if user has cash-related functions
  const hasCashFunction = userFunctions.includes('caixa') || userFunctions.includes('supervisao') || isAdmin;

  const hasFunction = useCallback((fn: OperationalFunction): boolean => {
    if (isAdmin) return true;
    return userFunctions.includes(fn);
  }, [userFunctions, isAdmin]);

  const hasPermission = (permission: string): boolean => {
    if (isAdmin) return true;
    
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
      canAccessAllUnits,
      hasPermission,
      signIn,
      signUp,
      signOut,
      // New exports
      userFunctions,
      userUnits,
      activeUnit,
      setActiveUnit,
      hasCashFunction,
      hasFunction,
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
