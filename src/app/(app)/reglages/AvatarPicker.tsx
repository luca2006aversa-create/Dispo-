'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { supabaseBrowser } from '@/lib/supabase/client';
import { compressSquare } from '@/lib/compress';

/** Choisir, changer ou retirer sa photo de profil. */
export function AvatarPicker() {
  const { me, groupId, toast } = useApp();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function save(path: string | null) {
    const sb = supabaseBrowser();
    const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', me.id);
    if (error) return false;
    if (me.avatar_path) await sb.storage.from('photos').remove([me.avatar_path]);
    router.refresh();
    return true;
  }

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressSquare(file);
      const path = `${groupId}/${me.id}/avatar-${crypto.randomUUID()}.jpg`;
      const sb = supabaseBrowser();
      const up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error || !(await save(path))) {
        if (!up.error) await sb.storage.from('photos').remove([path]);
        toast("La photo n'a pas pu être enregistrée, réessaie.");
      } else {
        toast('Photo de profil enregistrée');
      }
    } catch {
      toast('Impossible de lire cette image, essaie en JPEG ou PNG.');
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  async function remove() {
    setBusy(true);
    if (await save(null)) toast('Photo retirée');
    else toast("Ça n'a pas marché, réessaie.");
    setBusy(false);
  }

  return (
    <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Dot p={me} size={72} zoom />
      <div className="block" style={{ gap: 8, flex: 1, minWidth: 0 }}>
        <b>Ta photo de profil</b>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn flame sm" type="button" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Envoi…' : me.avatar_path ? 'Changer' : 'Choisir une photo'}
          </button>
          {me.avatar_path && <button className="btn ghost sm" type="button" disabled={busy} onClick={remove}>Retirer</button>}
        </div>
        <input ref={input} type="file" accept="image/*" hidden aria-label="Choisir une photo de profil"
          onChange={e => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
