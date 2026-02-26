
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { apiService } from '../services/apiService';

const LoginPage: React.FC<{ onLogin: (u: User) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Forgot password state
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiService.login({ email, password: pass });
      const authData = { ...response.user, token: response.token };
      onLogin(authData);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      await apiService.forgotPassword(forgotEmail);
      setView('sent');
    } catch (err: any) {
      setForgotError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in-95 duration-300">

        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-xl shadow-orange-100 mb-4">AU</div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
              <p className="text-slate-500 font-medium">Log in to find your study group</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="email" required
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-sm transition-all"
                    placeholder="u6.....@au.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setView('forgot'); setForgotError(''); }}
                    className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="password" required
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-sm transition-all"
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Login <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <p className="text-center text-slate-500 font-bold text-sm">
              Don't have an account? <Link to="/signup" className="text-orange-500 hover:text-orange-600 underline">Sign up for free</Link>
            </p>
          </>
        )}

        {/* ── FORGOT PASSWORD VIEW ── */}
        {view === 'forgot' && (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-xl shadow-orange-100 mb-4">AU</div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Forgot Password?</h1>
              <p className="text-slate-500 font-medium">Enter your email and we'll send a reset link</p>
            </div>

            {forgotError && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100">
                {forgotError}
              </div>
            )}

            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="email" required
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-sm transition-all"
                    placeholder="u6.....@au.edu"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : <>Send Reset Link <ArrowRight size={18} /></>}
              </button>
            </form>

            <button
              onClick={() => setView('login')}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 mx-auto"
            >
              <ArrowLeft size={16} /> Back to Login
            </button>
          </>
        )}

        {/* ── EMAIL SENT VIEW ── */}
        {view === 'sent' && (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-100 mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Check Your Email</h1>
              <p className="text-slate-500 font-medium">
                If an account with <span className="font-black text-slate-700">{forgotEmail}</span> exists, we've sent a password reset link. Check your inbox.
              </p>
              <p className="text-xs text-slate-400">The link expires in 60 minutes.</p>
            </div>

            <button
              onClick={() => setView('login')}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 mx-auto"
            >
              <ArrowLeft size={16} /> Back to Login
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
