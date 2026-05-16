// src/hooks/useCoefficients.ts
import { useState, useEffect } from 'react';

interface Coefficient {
  coef_key: string;
  coef_value: number;
}

const CACHE_KEY = 'apf_coefficients';
const CACHE_TTL = 60 * 60 * 1000; // 1 час

export const useCoefficients = (authToken?: string) => {
  const [coefficients, setCoefficients] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  useEffect(() => {
    const loadCoefficients = async () => {
      // Проверяем кэш в localStorage
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setCoefficients(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached coefficients:', e);
        }
      }

      // Загружаем с сервера
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${API_BASE}/api/coefficients`, { headers });
        if (!response.ok) throw new Error('Failed to load coefficients');
        
        const data: Coefficient[] = await response.json();
        const coefMap: Record<string, number> = {};
        data.forEach(c => {
          coefMap[c.coef_key] = c.coef_value;
        });
        
        // Сохраняем в кэш
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: coefMap,
          timestamp: Date.now()
        }));
        
        setCoefficients(coefMap);
      } catch (err: any) {
        console.error('Failed to load coefficients:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCoefficients();
  }, [authToken]);

  return { coefficients, loading, error };
};