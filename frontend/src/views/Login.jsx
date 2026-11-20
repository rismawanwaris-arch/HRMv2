import React, { useState } from 'react';
import { authApi } from '../services/api';

function Login({ onLogin, setView }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError('Username dan Password wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      const data = await authApi.login({ username: trimmedUser, password });
      if (data.success) {
        onLogin(data.token, data.username, data.role || 'master');
      } else {
        setError(data.message || 'Login gagal.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '20px',
      fontFamily: 'var(--font-body)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient Floating Background Orbs */}
      <div style={{
        position: 'absolute',
        top: '-12%',
        left: '-8%',
        width: '420px',
        height: '420px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'floatAmbient 10s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-8%',
        width: '460px',
        height: '460px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(147,51,234,0.2) 0%, transparent 70%)',
        filter: 'blur(45px)',
        animation: 'floatAmbient 13s ease-in-out infinite reverse',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 32px 64px -12px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.08)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        animation: 'cardReveal 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        {/* Top Accent Line */}
        <div style={{
          height: '4px',
          width: '100%',
          background: 'linear-gradient(90deg, var(--primary), var(--secondary), #10b981)'
        }} />

        {/* Header */}
        <div style={{ padding: '36px 40px 24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 18px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '28px',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            boxShadow: '0 10px 28px var(--primary-glow)',
            animation: 'popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both'
          }}>
            H
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '23px', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Cv. Asya Bisnis Indonesia
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Sistem Terpadu HRGA, Aset & Rekrutmen SDM
          </p>
        </div>

        {/* Login Form */}
        <div style={{ padding: '0 40px 32px' }}>
          {error && (
            <div style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--color-danger)',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username admin"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '13px 16px',
                  color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '13px 16px',
                  color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '15px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                justifyContent: 'center'
              }}
            >
              {loading ? 'Memverifikasi Sesi...' : 'Masuk ke Dashboard →'}
            </button>
          </form>
        </div>

        {/* Portal Links */}
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '22px 40px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 700 }}>
            Akses Portal Ujian Pelamar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setView('test')}
              className="portal-link-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Portal Ujian Kandidat
            </button>
            <button
              type="button"
              onClick={() => setView('training-portal')}
              className="portal-link-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 6v6l4 2"></path></svg>
              Portal Ujian Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
