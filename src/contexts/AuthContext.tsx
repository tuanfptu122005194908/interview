import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_user_role", { _user_id: userId });
      if (error) {
        console.warn("Error fetching role:", error);
        setRole(null);
        localStorage.removeItem("cached_role");
      } else {
        setRole(data as AppRole | null);
        localStorage.setItem("cached_role", data || "null");
      }
    } catch (err) {
      console.warn("Error in fetchRole:", err);
      setRole(null);
      localStorage.removeItem("cached_role");
    }
  };

  useEffect(() => {
    let isActive = true;
    
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isActive) return;
        
        if (error) {
          console.warn("Error getting session:", error);
        }
        
        if (session?.user) {
          setUser(session.user);
          // Load cached role immediately for fast render
          const cachedRole = localStorage.getItem("cached_role");
          if (cachedRole && cachedRole !== "null") {
            setRole(cachedRole as AppRole);
          }
          // Fetch fresh role in background (non-blocking)
          fetchRole(session.user.id);
        } else {
          setUser(null);
          setRole(null);
          localStorage.removeItem("cached_role");
        }
      } catch (err) {
        console.warn("Error initializing auth:", err);
        setUser(null);
        setRole(null);
        localStorage.removeItem("cached_role");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    // Set a timeout to prevent infinite loading (reduced to 2 seconds)
    const timeoutId = setTimeout(() => {
      if (isActive && loading) {
        console.warn("Auth initialization timeout, setting loading to false");
        setLoading(false);
      }
    }, 2000);

    // Initialize auth
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) return;
      
      setUser(session?.user ?? null);
      if (session?.user) {
        // Load cached role immediately
        const cachedRole = localStorage.getItem("cached_role");
        if (cachedRole && cachedRole !== "null") {
          setRole(cachedRole as AppRole);
        }
        // Fetch fresh role in background
        fetchRole(session.user.id);
      } else {
        setRole(null);
        localStorage.removeItem("cached_role");
      }
      setLoading(false);
    });

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err.message ?? "Lỗi đăng nhập" };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
    } catch (err) {
      console.warn("Error signing out:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
