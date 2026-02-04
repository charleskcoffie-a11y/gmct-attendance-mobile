import { useEffect, useState } from 'react';
import { getPendingSyncItems, markAsSynced, clearOldSyncedItems } from '../db';
import { saveAttendance } from '../supabase';

export default function SyncManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending items on mount
    checkPendingItems();

    // Clean up old synced items
    clearOldSyncedItems();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPendingItems = async () => {
    const items = await getPendingSyncItems();
    setPendingCount(items.length);
  };

  const syncData = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const pendingItems = await getPendingSyncItems();
      
      for (const item of pendingItems) {
        try {
          // Sync attendance records
          if (item.type === 'attendance') {
            const { classNumber, date, serviceType, memberRecords, classLeaderName } = item.data;
            await saveAttendance(classNumber, date, serviceType, memberRecords, classLeaderName);
            await markAsSynced(item.id!);
          }
        } catch (error) {
          console.error('Error syncing item:', item.id, error);
          // Continue with next item even if one fails
        }
      }

      // Update pending count
      await checkPendingItems();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync every 30 seconds when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      checkPendingItems();
      if (pendingCount > 0) {
        syncData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, pendingCount]);

  if (!isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50">
      {!isOnline && pendingCount > 0 && (
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{pendingCount} record{pendingCount > 1 ? 's' : ''} pending sync</span>
        </div>
      )}

      {isSyncing && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Syncing...</span>
        </div>
      )}
    </div>
  );
}
