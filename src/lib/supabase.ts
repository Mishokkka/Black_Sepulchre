import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL ?? 'https://xjmzsnvztqhjttcxeknf.supabase.co'
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_VHtz6kMBPZi23uurfdpJdg_hYbXKq6H'
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
