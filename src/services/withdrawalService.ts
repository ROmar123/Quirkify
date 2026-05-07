import { supabase } from '../supabase';

export interface WithdrawalRequest {
  id: string;
  profileId: string;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  reference?: string;
  adminNote?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function requestWithdrawal(params: {
  profileId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_profile_id: params.profileId,
    p_amount: params.amount,
    p_bank_name: params.bankName,
    p_account_number: params.accountNumber,
    p_account_holder: params.accountHolder,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchAllWithdrawals(status?: string): Promise<WithdrawalRequest[]> {
  let q = supabase
    .from('withdrawal_requests')
    .select('*, profile:profiles!withdrawal_requests_profile_id_fkey(display_name, email)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function approveWithdrawal(requestId: string, adminId: string, reference?: string): Promise<void> {
  const { error } = await supabase.rpc('approve_withdrawal', {
    p_request_id: requestId,
    p_admin_id: adminId,
    p_reference: reference ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_withdrawal', {
    p_request_id: requestId,
    p_admin_id: adminId,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function cancelWithdrawal(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('withdrawal_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'requested');
  if (error) throw new Error(error.message);
}

function mapRow(r: any): WithdrawalRequest {
  return {
    id: r.id,
    profileId: r.profile_id,
    amount: Number(r.amount),
    status: r.status,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    accountHolder: r.account_holder,
    reference: r.reference,
    adminNote: r.admin_note,
    reviewedAt: r.reviewed_at,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
