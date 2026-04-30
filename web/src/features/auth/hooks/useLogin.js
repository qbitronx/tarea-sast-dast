import { useState } from 'react';
import client from '../../../api/client';
import { useAuth } from '../../../shared/context/AuthContext';

export function useLogin() {
  const { login } = useAuth();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'mfa'
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitCredentials({ email, password }) {
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/login', { email, password });
      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setStep('mfa');
      } else {
        login(data.token, data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa({ code }) {
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/mfa/verify', { tempToken, code });
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return { step, loading, error, submitCredentials, submitMfa };
}
