import { useMemo } from 'react';

export function Login() {
  const startUrl = useMemo(() => {
    const origin = window.location.origin;
    const url = new URL('http://localhost:4000/api/auth/google/start');
    url.searchParams.set('redirect', origin);
    return url.toString();
  }, []);

  return (
    <div style={{
      display: 'grid',
      justifyItems: 'center',
      alignItems: 'start',
      minHeight: '70vh',
      paddingTop: '4vh',
      marginTop: '-4rem'
    }}>
      <div className="panel" style={{
        maxWidth: 480,
        width: '92%',
        textAlign: 'center',
        padding: '1.5rem',
        boxShadow: '0 24px 70px rgba(0,0,0,0.18), 0 12px 28px rgba(0,0,0,0.12)'
      }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Entrar</h2>
        <p className="subtitle">Faça login para acessar</p>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => { window.location.href = startUrl; }}>Entrar com Google</button>
        </div>
      </div>
    </div>
  );
}