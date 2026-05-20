import { useCallback, useEffect, useRef, useState } from "react";
import { accountService } from "../services/accountService";

const DEBOUNCE_MS = 350;
const DEFAULT_FILTERS = { search: "", status: "all", planVersion: "all" };

export function useAccounts(adminToken = "", visitorName = "", visitorId = "") {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [debouncedFilters, setDebouncedFilters] = useState(DEFAULT_FILTERS);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [filters]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [accountResponse, statsResponse] = await Promise.all([
        accountService.getAccounts(
          debouncedFilters,
          adminToken,
          visitorName,
          visitorId,
        ),
        accountService.getStats(),
      ]);

      setAccounts(accountResponse.data || []);
      setStats(statsResponse.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, adminToken, visitorName, visitorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createAccount = useCallback(
    async (payload) => {
      await accountService.createAccount(
        payload,
        adminToken,
        visitorName,
        visitorId,
      );
      await loadData();
    },
    [adminToken, visitorName, visitorId, loadData],
  );

  const updateAccount = useCallback(
    async (id, payload) => {
      await accountService.updateAccount(
        id,
        payload,
        adminToken,
        visitorName,
        visitorId,
      );
      await loadData();
    },
    [adminToken, visitorName, visitorId, loadData],
  );

  const deleteAccount = useCallback(
    async (id) => {
      await accountService.deleteAccount(id, adminToken);
      await loadData();
    },
    [adminToken, loadData],
  );

  const revealPassword = useCallback(
    async (id) => {
      const response = await accountService.revealPassword(
        id,
        adminToken,
        visitorName,
        visitorId,
      );
      return response.data;
    },
    [adminToken, visitorName, visitorId],
  );

  const requestAccess = useCallback(
    async (id) => {
      await accountService.requestAccess(id, visitorName, visitorId);
      await loadData();
    },
    [visitorName, visitorId, loadData],
  );

  const approveAccess = useCallback(
    async (accountId, requestId) => {
      await accountService.approveAccess(accountId, requestId, adminToken);
      await loadData();
    },
    [adminToken, loadData],
  );

  const rejectAccess = useCallback(
    async (accountId, requestId, reason = "") => {
      await accountService.rejectAccess(
        accountId,
        requestId,
        adminToken,
        reason,
      );
      await loadData();
    },
    [adminToken, loadData],
  );

  const revokeAccess = useCallback(
    async (accountId, requestId, reason = "") => {
      await accountService.revokeAccess(
        accountId,
        requestId,
        adminToken,
        reason,
      );
      await loadData();
    },
    [adminToken, loadData],
  );

  const deleteAccess = useCallback(
    async (accountId, requestId, reason = "") => {
      await accountService.deleteAccess(
        accountId,
        requestId,
        adminToken,
        reason,
      );
      await loadData();
    },
    [adminToken, loadData],
  );

  return {
    accounts,
    stats,
    loading,
    error,
    filters,
    setFilters,
    loadData,
    createAccount,
    updateAccount,
    deleteAccount,
    revealPassword,
    requestAccess,
    approveAccess,
    rejectAccess,
    revokeAccess,
    deleteAccess,
  };
}
