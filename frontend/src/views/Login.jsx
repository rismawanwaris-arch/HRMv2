import React, { useState } from 'react';
import API_BASE from '../config';

function Login({ onLogin, setView }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username dan Password wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        onLogin(data.token, data.username, data.role || 'master');
      } else {
        setError(data.message || 'Login gagal.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
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
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center',
              animation: 'popIn 0.28s ease forwards'
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
                  transition: 'all 0.25s ease'
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
                  transition: 'all 0.25s ease'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '15px',
                background: loading ? 'var(--primary-glow)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 24px var(--primary-glow)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Memverifikasi Sesi...' : 'Masuk ke Dashboard →'}
            </button>
          </form>
        </div>

        {/* Portal Links */}
        <div style={{
          background: 'rgba(11, 15, 25, 0.45)',
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
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Portal Ujian Kandidat
            </button>
            <button
              type="button"
              onClick={() => setView('training-portal')}
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
