import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [preview, setPreview] = useState([]);
  const [insertPolicy, setInsertPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, previewRes] = await Promise.all([
        client.get('/products'),
        client.get('/products/abac-preview'),
      ]);
      setProducts(listRes.data.products);
      setInsertPolicy(listRes.data.evaluation);
      setPreview(previewRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createProduct = useCallback(async (payload) => {
    const { data } = await client.post('/products', payload);
    await fetch();
    return data;
  }, [fetch]);

  const updateProduct = useCallback(async (id, payload) => {
    const { data } = await client.put(`/products/${id}`, payload);
    await fetch();
    return data;
  }, [fetch]);

  const deleteProduct = useCallback(async (id) => {
    const { data } = await client.delete(`/products/${id}`);
    await fetch();
    return data;
  }, [fetch]);

  return { products, preview, insertPolicy, loading, error, createProduct, updateProduct, deleteProduct, refetch: fetch };
}
