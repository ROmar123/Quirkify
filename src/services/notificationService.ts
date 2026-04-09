import { supabase } from '../supabase';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Promise<() => void> {
  // Initial fetch
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(50);
  callback(data || []);

  // Real-time via Supabase
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `userId=eq.${userId}`
    }, (payload) => {
      callback(prev => [payload.new as Notification, ...prev]);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function markAsRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

export async function createNotification(
  userId: string,
  title: string,
  message: string
): Promise<{ error: any }> {
  const { error } = await supabase.from('notifications').insert([{
    userId,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  }]);
  return { error };
}
