import { useEffect } from 'react';
import { api } from '../lib/api';

function genRandomUser() {
  const n = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
  return `user${n}`;
}

export function AuthBar({ userId, onLogin }: { userId: string; onLogin: (id: string) => void }) {
  const logged = Boolean(userId);

  const loginRandom = async () => {
    const randomName = genRandomUser();
    const res = await api.post('/auth/login', { username: randomName });
    onLogin(res.data.userId);
  };

  useEffect(() => {
    if (!logged) {
      // login automático ao carregar
      loginRandom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged]);

  return (
    <div className="authbar">
      {logged ? (
        <span>Usuário: {userId}</span>
      ) : (
        <span>Conectando...</span>
      )}
    </div>
  );
}