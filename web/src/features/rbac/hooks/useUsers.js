import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createUser = useCallback(async (payload) => {
    const { data } = await client.post('/users', payload);
    setUsers((prev) => [...prev, data]);
    return data;
  }, []);

  const updateUser = useCallback(async (id, payload) => {
    const { data } = await client.put(`/users/${id}`, payload);
    setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
    return data;
  }, []);

  const deleteUser = useCallback(async (id) => {
    await client.delete(`/users/${id}`);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const assignRole = useCallback(async (userId, roleId) => {
    const { data } = await client.post(`/users/${userId}/roles`, { roleId });
    setUsers((prev) => prev.map((u) => (u.id === userId ? data : u)));
  }, []);

  const removeRole = useCallback(async (userId, roleId) => {
    await client.delete(`/users/${userId}/roles/${roleId}`);
    await fetch();
  }, [fetch]);

  return { users, loading, error, createUser, updateUser, deleteUser, assignRole, removeRole, refetch: fetch };
}
