import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const ACCOUNTS = [
  { label: "HR 1", email: "interviewer1@interview.os", password: "interview123", color: "bg-pink-400", icon: "👔" },
  { label: "HR 2", email: "interviewer2@interview.os", password: "interview123", color: "bg-rose-400", icon: "👨‍💼" },
  { label: "HR 3", email: "interviewer3@interview.os", password: "interview123", color: "bg-pink-300", icon: "👩‍💼" },
  { label: "Viewer", email: "viewer@interview.os", password: "interview123", color: "bg-rose-300", icon: "👁️" },
];

const Cherry = ({ delay, offset }: { delay: string; offset: number }) => (
  <div
    className="absolute animate-cherry-fall text-2xl"
    style={{
      left: `${offset}%`,
      animationDelay: delay,
      animationDuration: `${8 + Math.random() * 4}s`,
    }}
  >
    ✿
  </div>
);

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-pink-300/30 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-pink-400 border-r-pink-400 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
        </div>
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 px-4 relative overflow-hidden">
      {/* Cherry blossoms falling animation */}
      <div className="fixed inset-0 pointer-events-none">
        <Cherry delay="0s" offset={10} />
        <Cherry delay="0.5s" offset={20} />
        <Cherry delay="1s" offset={30} />
        <Cherry delay="1.5s" offset={40} />
        <Cherry delay="2s" offset={50} />
        <Cherry delay="2.5s" offset={60} />
        <Cherry delay="3s" offset={70} />
        <Cherry delay="3.5s" offset={80} />
        <Cherry delay="4s" offset={90} />
        <Cherry delay="0.2s" offset={15} />
        <Cherry delay="0.7s" offset={25} />
        <Cherry delay="1.2s" offset={35} />
        <Cherry delay="1.7s" offset={45} />
        <Cherry delay="2.2s" offset={55} />
        <Cherry delay="2.7s" offset={65} />
        <Cherry delay="3.2s" offset={75} />
        <Cherry delay="3.7s" offset={85} />
      </div>

      {/* Light decorative background elements */}
      <div className="absolute top-0 left-0 w-60 h-60 bg-pink-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40"></div>
      <div className="absolute -bottom-8 right-0 w-60 h-60 bg-rose-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40" style={{ animationDelay: "2s" }}></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-12 animate-fade-in-scale">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 rounded-2xl blur-lg opacity-50 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-pink-300 to-rose-400 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-2xl border border-pink-300/40">
                ✿
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black text-rose-700 mb-2 tracking-tight">InterviewOS</h1>
          <p className="text-sm text-rose-600/70">Hệ thống đánh giá phỏng vấn chuyên nghiệp</p>
        </div>

        {/* Quick Login Section */}
        <div className="mb-8 animate-slide-in-up" style={{ animationDelay: "0.2s" }}>
          <p className="text-xs font-bold text-rose-500/70 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
            <span className="w-8 h-px bg-gradient-to-r from-rose-300 to-transparent"></span>
            Đăng nhập nhanh
            <span className="w-8 h-px bg-gradient-to-l from-rose-300 to-transparent"></span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ACCOUNTS.map((acc, idx) => (
              <button
                key={acc.email}
                onClick={() => handleQuickLogin(acc)}
                disabled={submitting}
                style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
                className="group relative animate-slide-in-up"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pink-300 to-rose-300 rounded-xl opacity-0 group-hover:opacity-40 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
                <div className={`relative px-5 py-4 rounded-xl bg-gradient-to-br from-white to-pink-50 border border-pink-200 group-hover:border-pink-400 transition-all duration-300 flex flex-col items-center gap-2 ${
                  submitting ? "opacity-50" : "cursor-pointer hover:translate-y-[-4px]"
                }`}>
                  <span className="text-2xl">{acc.icon}</span>
                  <span className="text-xs font-bold text-rose-700">{acc.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-8 animate-slide-in-up" style={{ animationDelay: "0.4s" }}>
          <div className="flex-1 h-px bg-gradient-to-r from-pink-300 to-transparent"></div>
          <span className="text-xs text-rose-600/60 uppercase tracking-wider font-semibold">hoặc</span>
          <div className="flex-1 h-px bg-gradient-to-l from-pink-300 to-transparent"></div>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-in-up" style={{ animationDelay: "0.5s" }}>
          {error && (
            <div className="px-5 py-3.5 rounded-xl bg-red-100/80 border border-red-300 text-sm text-red-700 font-medium animate-bounce-in flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-300 to-rose-300 rounded-xl opacity-0 group-hover:opacity-30 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="relative w-full rounded-xl border border-pink-200 bg-white/80 backdrop-blur-sm px-5 py-3.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-pink-400 transition-all duration-300 group-hover:border-pink-300"
              placeholder="Email đăng nhập"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-300 to-rose-300 rounded-xl opacity-0 group-hover:opacity-30 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="relative w-full rounded-xl border border-pink-200 bg-white/80 backdrop-blur-sm px-5 py-3.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-pink-400 transition-all duration-300 group-hover:border-pink-300"
              placeholder="Mật khẩu"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="relative w-full group mt-6"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 rounded-xl opacity-100 group-hover:opacity-110 transition-all duration-300 blur-xl group-hover:blur-2xl group-active:blur-lg"></div>
            <div className={`relative w-full px-6 py-4 rounded-xl bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
              submitting 
                ? "opacity-75 cursor-not-allowed" 
                : "hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl"
            }`}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Đang xác thực...
                </span>
              ) : (
                "Đăng nhập"
              )}
            </div>
          </button>
        </form>

        {/* Footer hint */}
        <p className="text-center text-xs text-rose-600/60 mt-8 animate-slide-in-up" style={{ animationDelay: "0.6s" }}>
          Dùng tài khoản demo để trải nghiệm
        </p>
      </div>
    </div>
  );
};

export default Login;
