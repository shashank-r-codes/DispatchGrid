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
  login: (email: string, password: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRoleQuick: (role: "ADMIN" | "CUSTOMER" | "TECH_AC" | "TECH_ELEC" | "TECHNICIAN") => Promise<{ success: boolean; error?: string }>;
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
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
      setIsLoading(false);
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
    const curToken = token || localStorage.getItem("dg_token");
    if (!curToken) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${curToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Notifications fetch failed:", err);
    }
  };

  const markNotificationRead = async (id: string) => {
    const curToken = token || localStorage.getItem("dg_token");
    setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: 1 } : n)));
    if (!curToken) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${curToken}` },
      });
    } catch {
      // ignore
    }
  };

  const markAllNotificationsRead = async () => {
    const curToken = token || localStorage.getItem("dg_token");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    if (!curToken) return;
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${curToken}` },
      });
    } catch {
      // ignore
    }
  };

  const login = async (email: string, password: string, role?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const payload: any = { email, password };
      if (role) payload.role = role;

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Authentication failed" };
      }

      localStorage.setItem("dg_token", data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      console.error("Login failed:", err);
      return { success: false, error: err.message || "Network error connecting to auth server" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("dg_token");
    setToken(null);
    setUser(null);
  };

  const switchRoleQuick = async (target: "ADMIN" | "CUSTOMER" | "TECH_AC" | "TECH_ELEC" | "TECHNICIAN"): Promise<{ success: boolean; error?: string }> => {
    let email = "admin@dispatchgrid.demo";
    let pwd = "admin123";
    let role = "ADMIN";

    if (target === "CUSTOMER") {
      email = "customer@dispatchgrid.demo";
      pwd = "12345";
      role = "CUSTOMER";
    } else if (target === "TECH_AC") {
      email = "electrician2@dispatchgrid.demo"; // Amit Patel (AC)
      pwd = "12345";
      role = "TECHNICIAN";
    } else if (target === "TECH_ELEC" || target === "TECHNICIAN") {
      email = "electrician1@dispatchgrid.demo"; // Rajesh Kumar (Electrical)
      pwd = "12345";
      role = "TECHNICIAN";
    }

    return await login(email, pwd, role);
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
        markAllNotificationsRead,
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
