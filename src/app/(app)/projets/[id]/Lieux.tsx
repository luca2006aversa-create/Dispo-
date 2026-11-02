'use client';

import { useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compress';
import { distanceKm, fmtKm, geocodeCity } from '@/lib/geo';
import { fairest, travel, type Point } from '@/lib/trip';
import type { ProjectData, Proposal } from './useProject';

const safeUrl = (u: string) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

export function Lieux({ d, reload }: { d: ProjectData; reload: () => void }) {
  const { me, members, groupId, toast } = useApp();
  const pr = d.project!;
  const people: Point[] = members.filter(m => m.lat != null && m.lon != null).map(m => ({ id: m.id, at: [Number(m.lat), Number(m.lon)] }));
  const at = (p: Proposal) => (p.lat != null && p.lon != null ? [p.lat, p.lon] as [number, number] : null);
  const fair = d.proposals.length > 1 ? d.proposals[fairest(d.proposals.map(at), people)]?.id : undefined;
  const sorted = [...d.proposals].sort((a, b) =>
    Number(b.id === pr.chosen_proposal) - Number(a.id === pr.chosen_proposal) || b.votes.length - a.votes.length || a.created - b.created);
  const sb = supabaseBrowser;

  async function run(op: PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await op;
    if (error) toast("Ça n'a pas marché, réessaie."); else { if (ok) toast(ok); reload(); }
  }

  return (
    <div className="block" style={{ gap: 16 }}>
      {people.length < members.length && (
        <p className="small muted" style={{ margin: 0 }}>
          Les distances ne comptent que les personnes qui ont mis leur ville dans leur profil.
        </p>
      )}
      {sorted.length ? sorted.map(p => {
        const who = members.find(m => m.id === p.user_id);
        const win = p.id === pr.chosen_proposal;
        const mine = p.votes.includes(me.id);
        const pos = at(p);
        const t = pos && people.length ? travel(pos, people) : null;
        const link = safeUrl(p.link);
        return (
          <article key={p.id} className={`opt${win ? ' win' : ''}`}>
            {p.photos.length > 0 && (
              <div className="strip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.photos.map(ph => <img key={ph.id} src={ph.url} alt={`Photo de ${p.place}`} loading="lazy" />)}
              </div>
            )}
            <div className="body">
              <div className="row" style={{ gap: 6 }}>
                {win && <span className="win-badge">On part là</span>}
                {p.id === fair && <span className="fair-badge">⚖️ Le plus juste pour tous</span>}
              </div>
              <div className="place">{p.place}</div>
              <div className="small muted">Proposé par {who?.first_name ?? 'quelqu’un'}</div>
              {p.info && <div className="info">{p.info}</div>}
              {link && <a href={link} target="_blank" rel="noopener noreferrer" className="small" style={{ overflowWrap: 'anywhere' }}>{link.replace(/^https?:\/\//, '').slice(0, 60)}</a>}
              {t ? (
                <div className="small">
                  <span className="muted">Trajets à vol d&apos;oiseau : </span>
                  {people.map(pp => `${members.find(m => m.id === pp.id)?.first_name} ${fmtKm(distanceKm(pp.at, pos!))}`).join(' · ')}
                  <br /><span className="muted">Le plus long : {members.find(m => m.id === t.longest.id)?.first_name}, {fmtKm(t.longest.km)}</span>
                </div>
              ) : !pos && <div className="small muted">Lieu introuvable sur la carte : pas de distances.</div>}

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8 }}>
                  <div className="faces">
                    {p.votes.map(id => <Dot key={id} p={members.find(m => m.id === id)} size={28} zoom />)}
                  </div>
                  <span className="small muted">{p.votes.length ? `${p.votes.length} partant${p.votes.length > 1 ? 's' : ''}` : 'Personne pour l’instant'}</span>
                </div>
                <button className={`btn sm ${mine ? 'ghost' : 'flame'}`} type="button"
                  onClick={() => run(mine
                    ? sb().from('proposal_votes').delete().eq('proposal_id', p.id).eq('user_id', me.id)
                    : sb().from('proposal_votes').insert({ proposal_id: p.id }))}>
                  {mine ? 'Finalement non' : 'Ça me tente'}
                </button>
              </div>

              <Comments p={p} onSend={body => run(sb().from('proposal_comments').insert({ proposal_id: p.id, body }))}
                onDelete={id => run(sb().from('proposal_comments').delete().eq('id', id))} />

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className={`btn sm ${win ? 'ghost' : ''}`} type="button"
                  onClick={() => run(sb().from('projects').update({ chosen_proposal: win ? null : p.id }).eq('id', pr.id), win ? 'Choix annulé' : 'C’est décidé ! 🎉')}>
                  {win ? 'Annuler ce choix' : 'On part là !'}
                </button>
                {p.user_id === me.id && <ConfirmButton label="Supprimer" onConfirm={() => run(sb().from('proposals').delete().eq('id', p.id), 'Proposition supprimée')} />}
              </div>
            </div>
          </article>
        );
      }) : <div className="empty">Pas encore de proposition. Ajoute la tienne : un lieu, des photos, ce que tu sais dessus.</div>}

      <NewProposal projectId={pr.id} groupId={groupId} meId={me.id} open={!d.proposals.length} onDone={reload} />
    </div>
  );
}

function Comments({ p, onSend, onDelete }: { p: Proposal; onSend: (body: string) => void; onDelete: (id: string) => void }) {
  const { me, members } = useApp();
  const [text, setText] = useState('');
  return (
    <div className="list">
      {p.comments.map(c => {
        const who = members.find(m => m.id === c.user_id);
        return (
          <div key={c.id} className="com">
            <Dot p={who} size={24} />
            <div className="b"><b className="small">{who?.first_name}</b><div>{c.body}</div></div>
            {c.user_id === me.id && <ConfirmButton label="×" onConfirm={() => onDelete(c.id)} />}
          </div>
        );
      })}
      <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={e => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
        <input aria-label={`Commenter ${p.place}`} maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="Ton avis, une question…" />
        <button className="btn sm" type="submit" disabled={!text.trim()}>Envoyer</button>
      </form>
    </div>
  );
}

function NewProposal({ projectId, groupId, meId, open, onDone }: {
  projectId: string; groupId: string; meId: string; open: boolean; onDone: () => void;
}) {
  const { toast } = useApp();
  const [place, setPlace] = useState('');
  const [info, setInfo] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDetailsElement>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const sb = supabaseBrowser();
    const pos = await geocodeCity(place.trim());
    const { data, error } = await sb.from('proposals').insert({
      project_id: projectId, place: place.trim(), info: info.trim(), link: safeUrl(link.trim()),
      lat: pos?.lat ?? null, lon: pos?.lon ?? null,
    }).select('id').single();
    if (error || !data) { setBusy(false); toast("La proposition n'a pas pu être ajoutée."); return; }
    let failed = 0;
    for (const f of [...(files.current?.files ?? [])].slice(0, 4)) {
      try {
        const blob = await compressImage(f, 1200, 300_000);
        const path = `${groupId}/${meId}/lieu-${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error || (await sb.from('proposal_photos').insert({ proposal_id: data.id, path })).error) failed++;
      } catch { failed++; }
    }
    setBusy(false);
    toast(failed ? `Proposition ajoutée, mais ${failed} photo${failed > 1 ? 's' : ''} n'a pas pu partir.` : 'Proposition ajoutée');
    setPlace(''); setInfo(''); setLink('');
    if (files.current) files.current.value = '';
    if (box.current) box.current.open = false;
    onDone();
  }

  return (
    <details ref={box} className="card" open={open}>
      <summary><b>Proposer un lieu</b></summary>
      <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <label htmlFor="o-place">Le lieu (une ville, pour la carte)
          <input id="o-place" required maxLength={80} value={place} onChange={e => setPlace(e.target.value)} placeholder="Chamonix" />
        </label>
        <label htmlFor="o-info">Ce que tu sais dessus
          <textarea id="o-info" rows={4} maxLength={2000} value={info} onChange={e => setInfo(e.target.value)}
            placeholder={'Transport : …\nLogement : …\nBudget : …\nActivités : …'} />
        </label>
        <label htmlFor="o-link">Un lien (facultatif)
          <input id="o-link" type="url" maxLength={300} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />
        </label>
        <label htmlFor="o-files">Photos du lieu (4 max)
          <input id="o-files" ref={files} type="file" accept="image/*" multiple />
        </label>
        <button className="btn flame" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Ajouter au projet'}</button>
      </form>
    </details>
  );
}
