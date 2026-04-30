import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';

export function useRoles() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        client.get('/roles'),
        client.get('/roles/permissions'),
      ]);
      setRoles(rolesRes.data);
      setAllPermissions(permsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load roles');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createRole = useCallback(async (payload) => {
    const { data } = await client.post('/roles', payload);
    setRoles((prev) => [...prev, data]);
    return data;
  }, []);

  const updateRole = useCallback(async (id, payload) => {
    const { data } = await client.put(`/roles/${id}`, payload);
    setRoles((prev) => prev.map((r) => (r.id === id ? data : r)));
    return data;
  }, []);

  const deleteRole = useCallback(async (id) => {
    await client.delete(`/roles/${id}`);
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const assignPermission = useCallback(async (roleId, permissionId) => {
    const { data } = await client.post(`/roles/${roleId}/permissions`, { permissionId });
    setRoles((prev) => prev.map((r) => (r.id === roleId ? data : r)));
  }, []);

  const removePermission = useCallback(async (roleId, permId) => {
    const { data } = await client.delete(`/roles/${roleId}/permissions/${permId}`);
    setRoles((prev) => prev.map((r) => (r.id === roleId ? data : r)));
  }, []);

  return {
    roles, allPermissions, loading, error,
    createRole, updateRole, deleteRole,
    assignPermission, removePermission,
    refetch: fetch,
  };
}
