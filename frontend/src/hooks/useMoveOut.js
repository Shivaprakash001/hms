import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export function useMoveOutTimeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/move-out/timeline', { params: { _t: Date.now() } });
      setData(res.data?.data || res.data || null);
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useMoveOutActions() {
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const clearMessages = () => { setActionError(''); setActionSuccess(''); };

  const submitRequest = async (payload) => {
    setSubmitting(true); clearMessages();
    try {
      await api.post('/move-out/requests', payload);
      setActionSuccess('Move-out request submitted successfully.');
      return true;
    } catch (e) {
      setActionError(e.response?.data?.error?.message || 'Failed to submit request');
      return false;
    } finally { setSubmitting(false); }
  };

  const cancelRequest = async (requestId) => {
    setSubmitting(true); clearMessages();
    try {
      await api.post(`/move-out/requests/${requestId}/cancel`);
      setActionSuccess('Request cancelled.');
      return true;
    } catch (e) {
      setActionError(e.response?.data?.error?.message || 'Failed to cancel');
      return false;
    } finally { setSubmitting(false); }
  };

  const raiseDispute = async (requestId, payload) => {
    setSubmitting(true); clearMessages();
    try {
      await api.post(`/move-out/requests/${requestId}/dispute`, payload);
      setActionSuccess('Dispute submitted. We\'ll review it shortly.');
      return true;
    } catch (e) {
      setActionError(e.response?.data?.error?.message || 'Failed');
      return false;
    } finally { setSubmitting(false); }
  };

  const submitFeedback = async (requestId, payload) => {
    setSubmitting(true); clearMessages();
    try {
      await api.post(`/move-out/requests/${requestId}/feedback`, payload);
      setActionSuccess('Thank you for your feedback!');
      return true;
    } catch (e) {
      setActionError(e.response?.data?.error?.message || 'Failed');
      return false;
    } finally { setSubmitting(false); }
  };

  return { submitting, actionError, actionSuccess, clearMessages, submitRequest, cancelRequest, raiseDispute, submitFeedback };
}
