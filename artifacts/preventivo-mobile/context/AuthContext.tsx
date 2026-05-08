import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AUTH_TOKEN_KEY = "prevai_auth_token";
const AUTH_USER_KEY = "prevai_auth_user";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(async () => token);
  }, [token]);

  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    void loadAuth();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? "Credenziali non valide");
    }
    const data = (await res.json()) as { token: string; user: AuthUser };
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
    };
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser)),
    ]);
    setToken(data.token);
    setUser(authUser);
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Registrazione fallita");
      }
      const data = (await res.json()) as { token: string; user: AuthUser };
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      };
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
        AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser)),
      ]);
      setToken(data.token);
      setUser(authUser);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      await fetch(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // ignore
    }
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
