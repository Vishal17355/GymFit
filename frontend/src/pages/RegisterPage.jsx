import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { roles } from '../data/roles';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export function RegisterPage() {
  const { user, checking, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={roles[user.role].path} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = data.get('password');
    if (password !== data.get('confirmation')) {
      setError('Passwords do not match.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Choose a password no longer than 72 UTF-8 bytes.');
      return;
    }

    setError('');
    setPending(true);
    try {
      await register(data.get('email'), data.get('invitation'), password);
      form.reset();
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (failure) {
      setError(failure instanceof TypeError ? 'Could not reach GymFit. Try again.' : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Create an account" description="Enter the email and invitation code you received.">
      <form className="auth-form" onSubmit={submit} method="post">
        <Input label="Email" type="email" name="email" autoComplete="username" maxLength={254} required />
        <Input label="Invitation code" name="invitation" autoComplete="off" spellCheck={false} maxLength={64} required />
        <Input label="Password" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={72} helperText="Use at least 12 characters." required />
        <Input label="Confirm password" type="password" name="confirmation" autoComplete="new-password" maxLength={72} required />
        {error && <p role="alert" className="auth-error">{error}</p>}
        <Button type="submit" icon={ArrowUpRight} iconPosition="right" disabled={checking} loading={pending}>Create account</Button>
      </form>
      <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}
