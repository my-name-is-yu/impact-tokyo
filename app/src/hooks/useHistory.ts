import { useState, useEffect, useCallback } from 'react';
import type { CareRecord, AlertNotification, Report, Document } from '../types';
import { getRecords, getAlerts, getReports, getDocuments } from '../lib/api';

const ALERTS_POLL_INTERVAL_MS = 10_000;

export function useHistory() {
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [fetchedRecords, fetchedAlerts, fetchedReports, fetchedDocuments] = await Promise.all([
        getRecords(),
        getAlerts(),
        getReports(),
        getDocuments(),
      ]);
      setRecords(fetchedRecords);
      setAlerts(fetchedAlerts);
      setReports(fetchedReports);
      setDocuments(fetchedDocuments);
    } catch {
      // silently ignore — caller can check empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchAll();
  }, [fetchAll]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Poll alerts every 10s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const fetchedAlerts = await getAlerts();
        setAlerts(fetchedAlerts);
      } catch {
        // ignore polling errors
      }
    }, ALERTS_POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return { records, alerts, reports, documents, isLoading, refresh };
}
