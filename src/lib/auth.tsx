import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Membership, Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; membership: Membership | null; loading: boolean }

const Ctx = createContext<AuthState>({ session: null, profile: null, membership: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, membership: null, loading: true })

  useEffect(() => {
    let mounted = true
    const load = async (session: Session | null) => {
      let profile: Profile | null = null
      let membership: Membership | null = null
      if (session) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        profile = data as Profile | null
        const { data: memberData } = await supabase.from('memberships').select('*').eq('user_id', session.user.id).maybeSingle()
        membership = memberData as Membership | null
      }
      if (mounted) setState({ session, profile, membership, loading: false })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
