import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Membership, Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; membership: Membership | null; clientId: string | null; loading: boolean }

const Ctx = createContext<AuthState>({ session: null, profile: null, membership: null, clientId: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, membership: null, clientId: null, loading: true })

  useEffect(() => {
    let mounted = true
    const load = async (session: Session | null) => {
      let profile: Profile | null = null
      let membership: Membership | null = null
      let clientId: string | null = null
      if (session) {
        const [{ data: p }, { data: m }, { data: ca }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
          supabase.from('memberships').select('*').eq('user_id', session.user.id).maybeSingle(),
          supabase.from('client_accounts').select('client_id').eq('user_id', session.user.id).maybeSingle(),
        ])
        profile = p as Profile | null
        membership = m as Membership | null
        clientId = ca?.client_id ?? null
      }
      if (mounted) setState({ session, profile, membership, clientId, loading: false })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
