import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const ACCOUNTS = [
  { label: "HR 1", email: "interviewer1@interview.os", password: "interview123", color: "gradient-primary" },
  { label: "HR 2", email: "interviewer2@interview.os", password: "interview123", color: "bg-accent" },
  { label: "HR 3", email: "interviewer3@interview.os", password: "interview123", color: "bg-success" },
  { label: "Viewer", email: "viewer@interview.os", password: "interview123", color: "bg-foreground" },
];

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  const handleQuickLogin = async (account: typeof ACCOUNTS[0]) => {
    setSubmitting(true);
    setError(null);
    const result = await signIn(account.email, account.password);
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-primary text-primary-foreground text-lg font-bold mb-5 shadow-lg">
            IV
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">InterviewOS</h1>
          <p className="text-sm text-muted-foreground mt-2">Hệ thống đánh giá phỏng vấn</p>
        </div>

        {/* Quick Login */}
        <div className="mb-8">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Đăng nhập nhanh</p>
          <div className="grid grid-cols-2 gap-2.5">
            {ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => handleQuickLogin(acc)}
                disabled={submitting}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card shadow-card hover:shadow-card-hover border border-border/50 hover:border-primary/15 transition-all duration-200 disabled:opacity-50 group"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${acc.color} group-hover:scale-125 transition-transform`} />
                <span className="text-sm font-semibold text-foreground">{acc.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">hoặc</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Manual Login */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15 font-medium">
              {error}
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40 transition-all"
            placeholder="Email"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40 transition-all"
            placeholder="Mật khẩu"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full gradient-primary text-primary-foreground py-3 rounded-xl hover:opacity-90 transition-all text-sm font-bold disabled:opacity-50 shadow-md"
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
