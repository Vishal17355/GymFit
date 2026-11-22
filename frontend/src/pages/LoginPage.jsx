import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { roles } from '../data/roles';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export function LoginPage() {
  const { user, checking, signIn } = useAuth();
  const { state } = useLocation();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={roles[user.role].path} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError('');
    setPending(true);
    try {
      await signIn(data.get('email'), data.get('password'));
      form.reset();
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Could not reach GymFit. Try again.' : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Sign in" description="Use your GymFit account to access your workspace.">
      {state?.registered && <p role="status" className="auth-notice">Account created. Sign in to open your workspace.</p>}
      <form className="auth-form" onSubmit={submit} method="post">
        <Input label="Email" type="email" name="email" autoComplete="username" maxLength={254} required />
        <Input label="Password" type="password" name="password" autoComplete="current-password" maxLength={72} required />
        {error && <p role="alert" className="auth-error">{error}</p>}
        <Button type="submit" icon={ArrowUpRight} iconPosition="right" disabled={checking} loading={pending}>Sign in</Button>
      </form>
      <p className="auth-footer">Have an invitation? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  );
}
