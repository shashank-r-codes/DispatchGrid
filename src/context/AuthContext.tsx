import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../types";

interface NotificationItem {
  notification_id: string;
  title: string;
  message: string;
  type: string;
  reference_id?: string;
  is_read: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRoleQuick: (role: "ADMIN" | "CUSTOMER" | "TECH_AC" | "TECH_ELEC") => Promise<void>;
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("dg_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Auto fetch user on mount if token exists
  useEffect(() => {
    if (token) {
      refreshUserProfile();
    } else {
      // Default to Admin in demo mode if no token stored yet
      switchRoleQuick("ADMIN");
    }
  }, [token]);

  const refreshUserProfile = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await refreshNotifications();
      } else {
        localStorage.removeItem("dg_token");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error("Auth profile refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshNotifications = async () => {
    if (!token) return;
    try {
      // In SQLite, notifications table stores notifications for current user
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // Mock/simulated notifications refresh endpoint via me
      }
    } catch {
      // ignore
    }
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: 1 } : n)));
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        console.warn("Login failed:", errData.error);
        return false;
      }

      const data = await res.json();
      localStorage.setItem("dg_token", data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("dg_token");
    setToken(null);
    setUser(null);
  };

  const switchRoleQuick = async (target: "ADMIN" | "CUSTOMER" | "TECH_AC" | "TECH_ELEC") => {
    setIsLoading(true);
    let email = "admin@dispatchgrid.io";
    let pwd = "admin123";

    if (target === "CUSTOMER") {
      email = "customer@example.com";
      pwd = "password123";
    } else if (target === "TECH_AC") {
      email = "amit.ac@dispatchgrid.io";
      pwd = "password123";
    } else if (target === "TECH_ELEC") {
      email = "rajesh.elec@dispatchgrid.io";
      pwd = "password123";
    }

    await login(email, pwd);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isLoading,
        login,
        logout,
        switchRoleQuick,
        notifications,
        refreshNotifications,
        markNotificationRead,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
