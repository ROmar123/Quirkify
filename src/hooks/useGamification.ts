import { useCallback } from 'react';
import { addXP } from '../services/gamificationService';
import { sendNotification } from '../services/notificationService';

const XP = {
  PURCHASE: 50,
  PURCHASE_BONUS: 10,  // per R100 spent, capped at 200
  AUCTION_WIN: 100,
  BID_PLACED: 5,
  PROFILE_COMPLETE: 25,
} as const;

export function useGamification() {
  const awardPurchase = useCallback(async (firebaseUid: string, orderTotal: number) => {
    const bonus = Math.min(Math.floor(orderTotal / 100) * XP.PURCHASE_BONUS, 200);
    const totalXP = XP.PURCHASE + bonus;
    await Promise.allSettled([
      addXP(firebaseUid, totalXP),
      sendNotification(firebaseUid, {
        type: 'order_update',
        title: `+${totalXP} XP earned!`,
        message: `You earned ${totalXP} XP for your purchase. Keep collecting!`,
      }),
    ]);
  }, []);

  const awardAuctionWin = useCallback(async (firebaseUid: string, productName: string, winningBid: number) => {
    await Promise.allSettled([
      addXP(firebaseUid, XP.AUCTION_WIN),
      sendNotification(firebaseUid, {
        type: 'auction_won',
        title: '🏆 You won the auction!',
        message: `You won "${productName}" with a bid of R${winningBid}. Head to Orders to complete payment.`,
        link: '/orders',
      }),
    ]);
  }, []);

  const awardBid = useCallback(async (firebaseUid: string) => {
    await addXP(firebaseUid, XP.BID_PLACED);
  }, []);

  const awardProfileComplete = useCallback(async (firebaseUid: string) => {
    await Promise.allSettled([
      addXP(firebaseUid, XP.PROFILE_COMPLETE),
      sendNotification(firebaseUid, {
        type: 'system',
        title: `+${XP.PROFILE_COMPLETE} XP — Profile complete!`,
        message: 'Your seller profile is live. Start listing your first item.',
        link: '/seller/onboarding',
      }),
    ]);
  }, []);

  return { awardPurchase, awardAuctionWin, awardBid, awardProfileComplete };
}
