import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/ProfileForm';

export default function Bienvenue() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/connexion');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.claims.sub).maybeSingle();
  if (profile) redirect('/');

  return (
    <main className="center">
      <div className="box">
        <h1 className="big-logo">Dispo<span>?</span></h1>
        <p style={{ textAlign: 'center', margin: 0 }}>
          <b>Bienvenue !</b> <span className="muted">Dis-nous qui tu es.</span>
        </p>
        <ProfileForm userId={data.claims.sub} />
      </div>
    </main>
  );
}
