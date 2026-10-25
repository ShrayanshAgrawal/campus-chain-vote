import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Vote, BarChart3, FileSearch, LogOut, User, LayoutDashboard } from 'lucide-react';
import { Badge } from './Badge';

export function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const navLinks = [
    { name: 'Elections', path: '/elections', icon: Vote },
    { name: 'Audit & Recount', path: '/audit', icon: FileSearch },
  ];

  if (isAdmin) {
    navLinks.push({ name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard });
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/elections" className="flex items-center space-x-2.5">
              <div className="bg-brand-600 text-white p-2 rounded-xl shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 tracking-tight text-lg leading-tight">
                  Campus<span className="text-brand-600">ChainVote</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  Tamper-Proof Voting
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex ml-8 space-x-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <div className="flex items-center justify-end space-x-2">
                <span className="text-sm font-semibold text-slate-900">{user?.name}</span>
                <Badge variant={user?.role === 'ADMIN' ? 'danger' : 'primary'}>
                  {user?.role}
                </Badge>
              </div>
              <span className="text-xs text-slate-500">
                {user?.enrollmentNo} {user?.branch ? `• ${user.branch}` : ''}
              </span>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="inline-flex items-center px-3 py-2 border border-slate-200 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
