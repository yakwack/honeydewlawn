import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
}

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Lawn Signups ─────────────────────────────────────────────────────────────
export async function fetchLawnSignup(userId) {
  const { data, error } = await supabase
    .from("lawn_signups")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveLawnSignup(payload) {
  const { data, error } = await supabase
    .from("lawn_signups")
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Visits ───────────────────────────────────────────────────────────────────
export async function fetchVisits(userId) {
  const { data, error } = await supabase
    .from("lawn_visits")
    .select("*")
    .eq("user_id", userId)
    .order("visit_date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

// Admin: fetch all visits across all users
export async function fetchAllVisits() {
  const { data, error } = await supabase
    .from("lawn_visits")
    .select("*, profiles(full_name), lawn_signups(first_name, last_name, address)")
    .order("visit_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertVisit(payload) {
  const { data, error } = await supabase
    .from("lawn_visits")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVisitStatus(visitId, status) {
  const { data, error } = await supabase
    .from("lawn_visits")
    .update({ status })
    .eq("id", visitId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVisit(visitId) {
  const { error } = await supabase
    .from("lawn_visits")
    .delete()
    .eq("id", visitId);
  if (error) throw error;
}

// ─── Contact Messages ─────────────────────────────────────────────────────────
export async function saveContactMessage(payload) {
  const { error } = await supabase
    .from("contact_messages")
    .insert(payload);
  if (error) throw error;
}

export async function fetchContactMessages() {
  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Admin: all signups ───────────────────────────────────────────────────────
export async function fetchAllSignups() {
  const { data, error } = await supabase
    .from("lawn_signups")
    .select("*, profiles(full_name, role)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateSignup(id, updates) {
  const { data, error } = await supabase
    .from("lawn_signups")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
// User: fetch own upcoming schedules
export async function fetchMySchedules(userId) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Admin: fetch all schedules with customer info
export async function fetchAllSchedules() {
  const { data, error } = await supabase
    .from('schedules')
    .select('*, lawn_signups(first_name, last_name, address, lot, services)')
    .order('scheduled_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Admin: create or update a schedule
export async function upsertSchedule(payload) {
  const { data, error } = await supabase
    .from('schedules')
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// Admin: delete a schedule
export async function deleteSchedule(id) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
  if (error) throw error
}