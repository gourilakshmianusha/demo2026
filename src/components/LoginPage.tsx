import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  initialized: boolean;
  configuredViaEnv: boolean;
  onAuthenticated: (token: string, email: string) => void;
}

async function safeParseResponse(res: Response): Promise<{ data: Record<string, unknown>; text: string }> {
  const text = await res.text();
  if (!text) return { data: {}, text: '' };
  try {
    return { data: JSON.parse(text) as Record<string, unknown>, text };
  } catch {
    return { data: {}, text };
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({
  initialized,
  configuredViaEnv,
  onAuthenticated,
}) => {
  const isFirstRun = !initialized && !configuredViaEnv;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    if (isFirstRun && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isFirstRun ? '/api/auth/setup' : '/api/auth/login';
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      // If admin was already initialized in env/server since status check, seamlessly try login
      if (isFirstRun && res.status === 403) {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
      }

      const { data } = await safeParseResponse(res);
      if (!res.ok) {
        const errMsg =
          typeof data.error === 'string' && data.error
            ? data.error
            : res.status === 401
              ? 'Invalid email or password.'
              : 'Unable to sign in. Please try again.';
        throw new Error(errMsg);
      }

      const token = typeof data.token === 'string' ? data.token : '';
      if (!token) {
        throw new Error('Authentication session could not be created. Please try again.');
      }

      const userObj =
        data.user && typeof data.user === 'object'
          ? (data.user as { email?: string })
          : {};
      onAuthenticated(token, userObj.email || trimmedEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(
        msg.toLowerCase().includes('expected pattern')
          ? 'Unable to reach the authentication service. Please refresh and try again.'
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <img
            src="/assets/aistudio/AFCCFDAF-04E5-4AA2-ADE0-E837A7BA9B92_a8ada254.png"
            alt="HK Surya Website Development"
            referrerPolicy="no-referrer"
            className="h-20 w-auto object-contain"
          />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#071A38] tracking-tight">
              HK Surya Workspace Login
            </h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {configuredViaEnv
                ? 'Sign in with your configured admin credentials (Settings > Secrets) to access the dashboard.'
                : initialized
                  ? 'Sign in with your admin email and password to open the Website Dev & SEO dashboard.'
                  : 'Enter your email and password to sign in and initialize your workspace dashboard.'}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 break-words"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hksurya.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#071A38] hover:bg-[#0d2b59] disabled:opacity-60 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
          >
            <span>{submitting ? 'Signing In...' : 'Sign In to Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          HK Surya Website Development · Website Dev &amp; SEO Portal
        </div>
      </div>
    </div>
  );
};
