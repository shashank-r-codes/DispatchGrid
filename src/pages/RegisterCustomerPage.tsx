import React, { useState } from "react";
import { Grid, User, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface RegisterCustomerPageProps {
  onNavigateLogin: () => void;
  onSuccess: () => void;
}

export const RegisterCustomerPage: React.FC<RegisterCustomerPageProps> = ({ onNavigateLogin, onSuccess }) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("+1-555-019-9921");
  const [password, setPassword] = useState<string>("customer123");
  const [address, setAddress] = useState<string>("45 Whitefield Main Road, Palm Meadows");
  const [city, setCity] = useState<string>("Bengaluru");
  const [pincode, setPincode] = useState<string>("560066");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          address,
          city,
          state: "Karnataka",
          pincode,
          latitude: 12.9698,
          longitude: 77.7499,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Customer account created successfully!", "success");
        await login(email, password);
        onSuccess();
      } else {
        showToast(data.error || "Registration failed", "error");
      }
    } catch {
      showToast("Error during registration", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-600 text-white items-center justify-center shadow-lg shadow-blue-500/20">
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create Customer Account
          </h2>
          <p className="text-xs text-slate-500">
            Book certified electricians, AC specialists, and plumbers with live route tracking.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Elena Watson"
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="elena@example.com"
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Residential Service Address *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            Create Customer Account <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center">
          <button onClick={onNavigateLogin} className="text-xs text-slate-500 hover:text-slate-800 font-semibold">
            Already have an account? Sign in &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
