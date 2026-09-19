import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; loading: boolean }

const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, loading: true })

  useEffect(() => {
    let mounted = true
    const load = async (session: Session | null) => {
      let profile: Profile | null = null
      if (session) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        profile = data as Profile | null
      }
      if (mounted) setState({ session, profile, loading: false })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
