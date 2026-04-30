import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';

export function useRbacProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [denied, setDenied]     = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(''); setDenied(false);
    try {
      const { data } = await client.get('/rbac/products');
      setProducts(data);
    } catch (err) {
      if (err.response?.status === 403) setDenied(true);
      else setError(err.response?.data?.error || 'Error al cargar productos');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createProduct = useCallback(async (payload) => {
    const { data } = await client.post('/rbac/products', payload);
    setProducts((prev) => [...prev, data]);
    return data;
  }, []);

  const updateProduct = useCallback(async (id, payload) => {
    const { data } = await client.put(`/rbac/products/${id}`, payload);
    setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
    return data;
  }, []);

  const deleteProduct = useCallback(async (id) => {
    await client.delete(`/rbac/products/${id}`);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { products, loading, error, denied, createProduct, updateProduct, deleteProduct, refetch: fetch };
}
