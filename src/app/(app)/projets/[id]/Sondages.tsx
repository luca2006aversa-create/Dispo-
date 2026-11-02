'use client';

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { ProjectData } from './useProject';

/** Sondages express : une question, 2 à 6 réponses, un vote d'un toucher. */
export function Sondages({ d, reload }: { d: ProjectData; reload: () => void }) {
  const { me, members, toast } = useApp();
  const pr = d.project!;
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  async function run(op: PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await op;
    if (error) toast("Ça n'a pas marché, réessaie."); else { if (ok) toast(ok); reload(); }
  }
  const sb = supabaseBrowser;

  function create(e: React.FormEvent) {
    e.preventDefault();
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (opts.length < 2) { toast('Il faut au moins deux réponses.'); return; }
    run(sb().from('polls').insert({ project_id: pr.id, question: question.trim(), options: opts }), 'Sondage lancé');
    setQuestion(''); setOptions(['', '']);
  }

  return (
    <div className="block" style={{ gap: 16 }}>
      {d.polls.length ? d.polls.map(p => {
        const mine = p.votes[me.id];
        const total = Object.keys(p.votes).length;
        return (
          <div key={p.id} className="card">
            <b>{p.question}</b>
            <div className="list">
              {p.options.map((o, i) => {
                const voters = Object.entries(p.votes).filter(([, c]) => c === i).map(([u]) => u);
                return (
                  <button key={i} type="button" className="item" aria-pressed={mine === i}
                    style={{ flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', borderColor: mine === i ? 'var(--flame)' : undefined }}
                    onClick={() => run(mine === i
                      ? sb().from('poll_votes').delete().eq('poll_id', p.id).eq('user_id', me.id)
                      : sb().from('poll_votes').upsert({ poll_id: p.id, user_id: me.id, choice: i }))}>
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <b>{o}{mine === i ? ' ✓' : ''}</b>
                      <span className="faces">{voters.map(u => <Dot key={u} p={members.find(m => m.id === u)} size={22} />)}</span>
                    </span>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${total ? (voters.length / total) * 100 : 0}%` }} /></span>
                  </button>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">{total}/{members.length} ont voté</span>
              {p.created_by === me.id && <ConfirmButton label="Supprimer" onConfirm={() => run(sb().from('polls').delete().eq('id', p.id))} />}
            </div>
          </div>
        );
      }) : <div className="empty">Pas de sondage. Une question rapide ? « Mer ou montagne ? », « Train ou voiture ? »…</div>}

      <form className="card" onSubmit={create}>
        <b>Nouveau sondage</b>
        <label htmlFor="poll-q">Question
          <input id="poll-q" required maxLength={120} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Mer ou montagne ?" />
        </label>
        {options.map((o, i) => (
          <input key={i} aria-label={`Réponse ${i + 1}`} maxLength={60} value={o} placeholder={`Réponse ${i + 1}`}
            onChange={e => setOptions(opts => opts.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <div className="row">
          {options.length < 6 && <button className="btn ghost sm" type="button" onClick={() => setOptions(o => [...o, ''])}>+ Une réponse</button>}
          <button className="btn flame" type="submit">Lancer le sondage</button>
        </div>
      </form>
    </div>
  );
}
