import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'outbid' | 'auction_won' | 'order_update' | 'system';
  read: boolean;
  createdAt: any;
  link?: string;
}

export const sendNotification = async (userId: string, data: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...data,
      userId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

export const subscribeToNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
    callback(notifications);
  }, (error) => {
    console.error('Error subscribing to notifications:', error);
    callback([]);
  });
};

export const markAsRead = async (notificationId: string) => {
  const ref = doc(db, 'notifications', notificationId);
  await updateDoc(ref, { read: true });
};

export const deleteNotification = async (notificationId: string) => {
  const ref = doc(db, 'notifications', notificationId);
  await deleteDoc(ref);
};
