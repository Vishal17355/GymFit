import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

async function readSession() {
  const response = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not reach GymFit. Try again.');
  return response.json();
}

function csrfHeaders(session) {
  return { [session.csrfHeader]: session.csrfToken };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    readSession()
      .then((result) => { if (active) setSession(result); })
      .catch(() => {})
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const signIn = async (email, password) => {
    const current = await readSession();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: csrfHeaders(current),
      body: new URLSearchParams({ email, password }),
    });
    if (response.status === 401) throw new Error('Email or password is incorrect.');
    if (!response.ok) throw new Error('Could not sign in. Try again.');

    const authenticated = await readSession();
    if (!authenticated.user) throw new Error('Could not establish a session. Try again.');
    setSession(authenticated);
    return authenticated.user;
  };

  const register = async (email, invitation, password) => {
    const current = await readSession();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: csrfHeaders(current),
      body: new URLSearchParams({ email, invitation: invitation.trim(), password }),
    });
    if (response.status === 400 || response.status === 409) {
      throw new Error('Check the invitation code and email, then try again.');
    }
    if (!response.ok) throw new Error('Could not create your account. Try again.');
  };

  const signOut = async () => {
    const current = await readSession();
    if (current.user) {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: csrfHeaders(current) });
      if (!response.ok) throw new Error('Could not sign out. Try again.');
    }
    setSession(null);
  };

  const request = useCallback(async (path, options = {}) => {
    const method = options.method || 'GET';
    const headers = new Headers(options.headers);
    if (method !== 'GET' && session) headers.set(session.csrfHeader, session.csrfToken);
    const response = await fetch(path, { ...options, headers, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      try {
        const current = await readSession();
        if (!current.user) setSession((previous) => previous === session ? current : previous);
      } catch {
        if (response.status === 401) setSession((previous) => previous === session ? null : previous);
      }
    }
    return response;
  }, [session]);

  return (
    <AuthContext.Provider value={{ user: session?.user, checking, signIn, register, signOut, request }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
