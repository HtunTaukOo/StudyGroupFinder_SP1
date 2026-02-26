import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../services/apiService';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid reset link. Please request a new one.');
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiService.resetPassword({ token, email, password, password_confirmation: confirm });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in-95 duration-300">

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Password Reset!</h1>
            <p className="text-slate-500 font-medium">Your password has been updated. You can now log in with your new password.</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all mt-4"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-xl shadow-orange-100 mb-4">AU</div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Set New Password</h1>
              <p className="text-slate-500 font-medium">Choose a strong password for your account</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {!error || password ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="password" required minLength={8}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-sm transition-all"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="password" required minLength={8}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-sm transition-all"
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !token || !email}
                  className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            ) : null}

            <p className="text-center text-slate-500 font-bold text-sm">
              <Link to="/login" className="text-orange-500 hover:text-orange-600 underline">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
