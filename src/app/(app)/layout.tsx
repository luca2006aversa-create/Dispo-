import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Member, Profile } from '@/lib/people';
import { AppProvider } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { TabBar } from '@/components/TabBar';
import { RegisterSW } from '@/components/RegisterSW';
import { Entrance } from '@/components/Entrance';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<div className="center"><div className="big-logo" aria-label="Chargement">Dispo<span>?</span></div></div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

/** Lit la session (cookies) : rendu à la demande, derrière le Suspense. */
async function Shell({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/connexion');
  const uid = auth.claims.sub;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle<Profile>();
  if (!profile) redirect('/bienvenue');

  const { data: mine } = await supabase.from('group_members').select('group_id, role, joined_at')
    .eq('user_id', uid).order('joined_at').limit(1);
  const groupId = mine?.[0]?.group_id as string | undefined;
  if (!groupId) {
    return (
      <main className="center">
        <div className="box">
          <h1 className="big-logo">Dispo<span>?</span></h1>
          <p className="notice">Tu n&apos;es encore dans aucun groupe. Demande à Luca de t&apos;inviter, puis rouvre l&apos;app.</p>
        </div>
      </main>
    );
  }

  const { data: rows } = await supabase.from('group_members').select('user_id, role, joined_at').eq('group_id', groupId);
  const ids = (rows ?? []).map(r => r.user_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  const members: Member[] = (rows ?? [])
    .map(r => {
      const p = profiles?.find(x => x.id === r.user_id);
      return p ? { ...p, role: r.role, joined_at: r.joined_at } : null;
    })
    .filter((m): m is Member => !!m)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const me = members.find(m => m.id === uid)!;

  return (
    <AppProvider me={me} groupId={groupId} members={members}>
      <div className="wrap">
        <header className="top">
          <Link href="/" className="logo" aria-label="Dispo ? (accueil)">Dispo<span className="q">?</span></Link>
          <Link href="/reglages" className="me-chip" aria-label="Mon profil et les réglages">
            <Dot p={me} />
            <span>{me.first_name}</span>
          </Link>
        </header>
        <main>{children}</main>
      </div>
      <TabBar />
      <RegisterSW />
      <Entrance />
    </AppProvider>
  );
}
