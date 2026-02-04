// Offline Database using Dexie (IndexedDB wrapper)
import Dexie, { Table } from 'dexie';
import { Member, SyncQueueItem } from './types';

export class AttendanceDatabase extends Dexie {
  members!: Table<Member, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  
  constructor() {
    super('gmct_attendance');
    
    this.version(1).stores({
      members: 'id, name, assignedClass',
      syncQueue: '++id, synced, timestamp'
    });
  }
}

export const db = new AttendanceDatabase();

// Save members to offline storage
export async function cacheMembers(members: Member[]) {
  try {
    await db.members.clear();
    await db.members.bulkAdd(members);
  } catch (error) {
    console.error('Error caching members:', error);
  }
}

// Get cached members
export async function getCachedMembers(classNumber: number): Promise<Member[]> {
  try {
    return await db.members
      .where('assignedClass')
      .equals(classNumber)
      .toArray();
  } catch (error) {
    console.error('Error getting cached members:', error);
    return [];
  }
}

// Add attendance to sync queue
export async function addToSyncQueue(attendanceData: {
  classNumber: number;
  date: string;
  serviceType: 'sunday' | 'bible-study';
  memberRecords: Array<{ memberId: string; status: string }>;
  classLeaderName?: string;
}) {
  try {
    await db.syncQueue.add({
      type: 'attendance',
      data: attendanceData,
      timestamp: new Date().toISOString(),
      synced: false
    });
  } catch (error) {
    console.error('Error adding to sync queue:', error);
    throw error;
  }
}

// Get pending sync items
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  try {
    const items = await db.syncQueue.toArray();
    return items.filter(item => !item.synced);
  } catch (error) {
    console.error('Error getting pending sync items:', error);
    return [];
  }
}

// Mark sync item as synced
export async function markAsSynced(id: number) {
  try {
    await db.syncQueue.update(id, { synced: true });
  } catch (error) {
    console.error('Error marking as synced:', error);
  }
}

// Clear synced items (older than 7 days)
export async function clearOldSyncedItems() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const items = await db.syncQueue.toArray();
    const oldItems = items.filter((item: SyncQueueItem) => 
      item.synced && new Date(item.timestamp) < sevenDaysAgo
    );
    
    const idsToDelete = oldItems.map((item: SyncQueueItem) => item.id!);
    if (idsToDelete.length > 0) {
      await db.syncQueue.bulkDelete(idsToDelete);
    }
  } catch (error) {
    console.error('Error clearing old synced items:', error);
  }
}
