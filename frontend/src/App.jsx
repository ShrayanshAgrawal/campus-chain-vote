import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';

import { Login } from './pages/Login';
import { Elections } from './pages/Elections';
import { Ballot } from './pages/Ballot';
import { Receipt } from './pages/Receipt';
import { Results } from './pages/Results';
import { Audit } from './pages/Audit';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminElectionDetail } from './pages/AdminElectionDetail';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<Login />} />

              {/* Student & Voter Protected Routes */}
              <Route
                path="/elections"
                element={
                  <ProtectedRoute>
                    <Elections />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ballot/:id"
                element={
                  <ProtectedRoute requiredRole="STUDENT">
                    <Ballot />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receipt"
                element={
                  <ProtectedRoute>
                    <Receipt />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/results/:id"
                element={
                  <ProtectedRoute>
                    <Results />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute>
                    <Audit />
                  </ProtectedRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/elections/:id"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminElectionDetail />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/elections" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
