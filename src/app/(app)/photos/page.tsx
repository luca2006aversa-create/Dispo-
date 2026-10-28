'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compress';
import { defiOfDay, DEFIS } from '@/lib/defis';
import { dayKey, fmtDay, fmtTime } from '@/lib/time';

const REACTS = ['😂', '😍', '🔥', '😱', '👏'];

export default function PhotosPage() {
  return (
    <Suspense>
      <Photos />
    </Suspense>
  );
}

function Photos() {
  const { me, byId, photos, groupId, customDefis, now, reload, toast } = useApp();
  const params = useSearchParams();
  const [chosen, setDefi] = useState<string | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [newDefi, setNewDefi] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const defi = chosen ?? params.get('defi') ?? defiOfDay(dayKey(now, me.timezone));

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(f?: File) {
    if (!f) return;
    try {
      const blob = await compressImage(f);
      setFile(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setFile(null);
      toast('Impossible de lire cette image, essaie en JPEG ou PNG.');
    }
  }

  function shuffle() {
    const all = [...DEFIS, ...customDefis];
    setDefi(all[Math.floor(Math.random() * all.length)]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast("Choisis d'abord une photo."); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    const path = `${groupId}/${me.id}/${crypto.randomUUID()}.jpg`;
    const up = await sb.storage.from('photos').upload(path, file, { contentType: 'image/jpeg' });
    if (up.error) {
      setBusy(false);
      toast("L'envoi a échoué. Vérifie ta connexion et réessaie.");
      return;
    }
    const { error } = await sb.from('photos').insert({
      group_id: groupId, path, caption: caption.trim(), challenge: defi,
      local_day: dayKey(Date.now(), me.timezone),
    });
    setBusy(false);
    if (error) {
      await sb.storage.from('photos').remove([path]);
      toast("L'envoi a échoué, réessaie.");
      return;
    }
    toast('Photo envoyée, flamme entretenue 🔥');
    setFile(null);
    setPreview('');
    setCaption('');
    if (fileInput.current) fileInput.current.value = '';
    reload('photos');
  }

  async function react(photoId: string, emoji: string, current?: string) {
    const sb = supabaseBrowser();
    const { error } = current === emoji
      ? await sb.from('photo_reactions').delete().eq('photo_id', photoId).eq('user_id', me.id)
      : await sb.from('photo_reactions').upsert({ photo_id: photoId, user_id: me.id, emoji });
    if (error) toast("Ça n'a pas marché, réessaie."); else reload('photos');
  }

  async function removePhoto(id: string, path: string) {
    const sb = supabaseBrowser();
    const { error } = await sb.from('photos').delete().eq('id', id);
    if (error) { toast("Ça n'a pas marché, réessaie."); return; }
    await sb.storage.from('photos').remove([path]);
    toast('Photo supprimée');
    reload('photos');
  }

  async function proposeDefi() {
    const text = newDefi.trim();
    if (text.length < 3) return;
    const { error } = await supabaseBrowser().from('challenges').insert({ group_id: groupId, text });
    if (error) { toast("Ça n'a pas marché, réessaie."); return; }
    setNewDefi('');
    toast('Défi ajouté à la boîte');
    reload('defis');
  }

  return (
    <section className="tab">
      <form className="card" onSubmit={send}>
        <h1>Poster une photo</h1>
        <div className="small">
          <span className="muted">Défi :</span> <b>{defi || 'aucun, photo libre'}</b>{' '}
          <span className="row" style={{ display: 'inline-flex', gap: 6, marginTop: 6 }}>
            <button className="btn ghost sm" type="button" onClick={shuffle}>Un autre</button>
            <button className="btn ghost sm" type="button" onClick={() => setDefi('')}>Sans défi</button>
          </span>
        </div>
        <label htmlFor="p-file">
          Ta photo
          <input ref={fileInput} id="p-file" type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} className="preview" alt="Aperçu de ta photo" />}
        <label htmlFor="p-cap">
          Légende
          <input id="p-cap" maxLength={120} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Raconte en deux mots" />
        </label>
        <button className="btn flame" type="submit" disabled={busy || !file}>{busy ? 'Envoi…' : 'Envoyer'}</button>
      </form>

      <details className="card">
        <summary><b>Proposer un défi</b> <span className="small muted">(il rejoint la boîte à défis)</span></summary>
        <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
          <input aria-label="Ton idée de défi" maxLength={120} value={newDefi} onChange={e => setNewDefi(e.target.value)} placeholder="Une photo de ton plus beau chausson" />
          <button className="btn sm" type="button" onClick={proposeDefi}>Ajouter</button>
        </div>
      </details>

      <div className="feed">
        {photos.length ? photos.map(ph => {
          const who = byId[ph.user_id];
          const counts: Record<string, number> = {};
          Object.values(ph.reactions).forEach(e => { counts[e] = (counts[e] ?? 0) + 1; });
          const mine = ph.reactions[me.id];
          return (
            <article key={ph.id} className="pol">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt={`Photo de ${who?.first_name ?? 'quelqu’un'}${ph.caption ? ' : ' + ph.caption : ''}`} loading="lazy" />
              {ph.challenge && <div className="tag">Défi : {ph.challenge}</div>}
              {ph.caption && <div className="cap">{ph.caption}</div>}
              <div className="meta">
                <span className="row" style={{ gap: 6 }}>
                  <Dot p={who} size={22} />
                  <span>{who?.first_name} · {fmtDay(ph.created, me.timezone)}, {fmtTime(ph.created, me.timezone)}</span>
                </span>
                {ph.user_id === me.id && <ConfirmButton label="Supprimer" onConfirm={() => removePhoto(ph.id, ph.path)} />}
              </div>
              <div className="reacts">
                {REACTS.map(e => (
                  <button key={e} type="button" className="react" aria-pressed={mine === e}
                    aria-label={`Réagir ${e}${counts[e] ? `, ${counts[e]} réaction${counts[e] > 1 ? 's' : ''}` : ''}`}
                    onClick={() => react(ph.id, e, mine)}>
                    {e}{counts[e] ? <span className="k">{counts[e]}</span> : null}
                  </button>
                ))}
              </div>
            </article>
          );
        }) : <div className="empty">Pas encore de photo. Relève le défi du jour pour allumer la première flamme.</div>}
      </div>
    </section>
  );
}
