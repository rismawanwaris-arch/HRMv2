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
    } catch (err) {
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
      fontFamily: "var(--font-body)"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 32px 64px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '40px 40px 24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 8px 24px var(--primary-glow)'
          }}>
            H
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 700 }}>Cv. Asya Bisnis Indonesia</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Sistem Manajemen Rekrutmen & SDM</p>
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
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '14px 16px',
                  color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '14px 16px',
                  color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '16px',
                background: loading ? 'var(--primary-glow)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 24px var(--primary-glow)',
                transition: 'all 0.3s'
              }}
            >
              {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
            </button>
          </form>
        </div>

        {/* Portal Links */}
        <div style={{
          background: 'var(--bg-main)',
          padding: '24px 40px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Akses Ujian Pelamar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setView('test')}
              style={{
                width: '100%', padding: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Portal Ujian Kandidat
            </button>
            <button
              type="button"
              onClick={() => setView('training-portal')}
              style={{
                width: '100%', padding: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
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
