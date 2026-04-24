import { supabase } from '../supabase';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'outbid' | 'auction_won' | 'order_update' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
}

type DbRow = Record<string, unknown>;

function rowToNotification(row: DbRow): Notification {
  return {
    id: row.id as string,
    userId: row.firebase_uid as string,
    title: row.title as string,
    message: row.message as string,
    type: (row.type as Notification['type']) || 'system',
    read: Boolean(row.read),
    createdAt: row.created_at as string,
    link: (row.link as string) || undefined,
  };
}

export const sendNotification = async (
  userId: string,
  data: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>
): Promise<void> => {
  const { error } = await supabase.from('notifications').insert({
    firebase_uid: userId,
    title: data.title,
    message: data.message,
    type: data.type,
    read: false,
    link: data.link || null,
  });
  if (error) console.error('[notifications] send failed:', error.message);
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  let disposed = false;

  const fetchAll = async () => {
    if (disposed) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('firebase_uid', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!disposed) {
      if (error) { callback([]); return; }
      callback((data || []).map(rowToNotification));
    }
  };

  void fetchAll();

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `firebase_uid=eq.${userId}` },
      () => { void fetchAll(); }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Polling fallback: already fetched on mount, next fetch on unmount/remount
      }
    });

  return () => {
    disposed = true;
    void supabase.removeChannel(channel);
  };
};

export const markAsRead = async (notificationId: string): Promise<void> => {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  await supabase.from('notifications').delete().eq('id', notificationId);
};
