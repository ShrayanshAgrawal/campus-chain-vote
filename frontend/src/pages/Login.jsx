import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldCheck, LogIn, UserPlus, Vote,
  AlertCircle, Eye, EyeOff,
} from 'lucide-react';
import { Spinner } from '../components/Spinner';

const TABS = [
  { id: 'voter',          label: 'Voter Login',  icon: Vote },
  { id: 'admin-login',    label: 'Admin Login',  icon: LogIn },
  { id: 'admin-register', label: 'Create Admin', icon: UserPlus },
];

// ── Defined OUTSIDE component so they don't re-mount on every render ──────────
function TextInput({ label, value, onChange, placeholder, mono = false, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type="text"
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`block w-full px-4 py-3 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 text-sm ${mono ? 'font-mono' : ''}`}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function PwdInput({ value, onChange, placeholder = 'Enter password', showPwd, onToggle }) {
  return (
    <div className="relative">
      <input
        type={showPwd ? 'text' : 'password'}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full px-4 py-3 pr-11 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function Login() {
  const [tab, setTab] = useState('voter');

  // Voter state
  const [vAdminId,    setVAdminId]    = useState('');
  const [vEnrollment, setVEnrollment] = useState('');
  const [vPassword,   setVPassword]   = useState('');

  // Admin login state
  const [aId,       setAId]       = useState('');
  const [aPassword, setAPassword] = useState('');

  // Admin register state
  const [rId,       setRId]       = useState('');
  const [rName,     setRName]     = useState('');
  const [rPassword, setRPassword] = useState('');
  const [rConfirm,  setRConfirm]  = useState('');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  function reset() { setError(''); }
  function switchTab(t) { setTab(t); reset(); setShowPwd(false); }

  async function handleVoterLogin(e) {
    e.preventDefault();
    setLoading(true); reset();
    try {
      const res = await api.voterLogin(vAdminId.trim(), vEnrollment.trim(), vPassword.trim());
      login(res.token, res.user);
      navigate('/elections');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally { setLoading(false); }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoading(true); reset();
    try {
      const res = await api.adminLogin(aId.trim(), aPassword.trim());
      login(res.token, res.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid Admin ID or password');
    } finally { setLoading(false); }
  }

  async function handleAdminRegister(e) {
    e.preventDefault();
    if (rPassword !== rConfirm) { setError('Passwords do not match'); return; }
    setLoading(true); reset();
    try {
      const res = await api.registerAdmin(rId.trim(), rName.trim(), rPassword);
      login(res.token, res.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-card mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Campus<span className="text-brand-600">ChainVote</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">Tamper-Proof Hybrid Blockchain Campus Elections</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm mb-4 bg-white">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex-1 flex flex-col items-center py-3 px-2 text-xs font-semibold transition
                  ${active ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Icon className="w-4 h-4 mb-1" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-card">

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── VOTER LOGIN ── */}
          {tab === 'voter' && (
            <form onSubmit={handleVoterLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                Enter the <strong>Admin ID</strong> given by your election admin, your <strong>enrollment number</strong>, and your <strong>password</strong>.
              </div>
              <TextInput
                label="Admin ID"
                value={vAdminId}
                onChange={e => setVAdminId(e.target.value)}
                placeholder="e.g. ADMIN001"
                mono
                hint="The ID of the admin who registered you"
              />
              <TextInput
                label="Enrollment Number"
                value={vEnrollment}
                onChange={e => setVEnrollment(e.target.value)}
                placeholder="e.g. 23100BTCSDSI14399"
                mono
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <PwdInput
                  value={vPassword}
                  onChange={e => setVPassword(e.target.value)}
                  placeholder="Password set by your admin"
                  showPwd={showPwd}
                  onToggle={() => setShowPwd(p => !p)}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-semibold text-sm shadow-sm transition disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" className="mr-2 border-white" /> : <Vote className="w-4 h-4 mr-2" />}
                Login as Voter
              </button>
            </form>
          )}

          {/* ── ADMIN LOGIN ── */}
          {tab === 'admin-login' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                Login with the <strong>Admin ID</strong> and <strong>password</strong> you chose when you created your account.
              </div>
              <TextInput
                label="Admin ID"
                value={aId}
                onChange={e => setAId(e.target.value)}
                placeholder="e.g. ADMIN001"
                mono
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <PwdInput
                  value={aPassword}
                  onChange={e => setAPassword(e.target.value)}
                  showPwd={showPwd}
                  onToggle={() => setShowPwd(p => !p)}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-semibold text-sm shadow-sm transition disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" className="mr-2 border-white" /> : <LogIn className="w-4 h-4 mr-2" />}
                Login as Admin
              </button>
            </form>
          )}

          {/* ── CREATE NEW ADMIN ── */}
          {tab === 'admin-register' && (
            <form onSubmit={handleAdminRegister} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                Create your own admin account. Choose a unique <strong>Admin ID</strong> — voters will need this to log in to your elections.
              </div>
              <TextInput
                label="Full Name"
                value={rName}
                onChange={e => setRName(e.target.value)}
                placeholder="e.g. Shrayansh Sharma"
              />
              <TextInput
                label="Admin ID"
                value={rId}
                onChange={e => setRId(e.target.value)}
                placeholder="e.g. ADMIN_SHRAYANSH"
                mono
                hint="Letters, numbers, _ and - only. Voters will use this to login."
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password <span className="text-slate-400 font-normal">(min 6 characters)</span>
                </label>
                <PwdInput
                  value={rPassword}
                  onChange={e => setRPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  showPwd={showPwd}
                  onToggle={() => setShowPwd(p => !p)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={rConfirm}
                  onChange={e => setRConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className={`block w-full px-4 py-3 rounded-xl border shadow-sm focus:ring-2 focus:ring-brand-500 text-slate-900 text-sm
                    ${rConfirm && rConfirm !== rPassword ? 'border-rose-400 bg-rose-50' : 'border-slate-300'}`}
                />
                {rConfirm && rConfirm !== rPassword && (
                  <p className="mt-1 text-xs text-rose-600">Passwords do not match</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !!(rConfirm && rConfirm !== rPassword)}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold text-sm shadow-sm transition disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" className="mr-2 border-white" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create Admin Account
              </button>
            </form>
          )}

        </div>

        {/* Info box */}
        <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">How it works:</p>
          <p>1. Admin creates an account → gets a unique Admin ID</p>
          <p>2. Admin uploads voters CSV (name, enrollment, password)</p>
          <p>3. Voter logs in using <strong>Admin ID + Enrollment Number + Password</strong></p>
          <p>4. Each admin's elections and voters are completely isolated</p>
        </div>

      </div>
    </div>
  );
}
