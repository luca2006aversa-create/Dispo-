'use client';

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { budget, fmtEuros, parseEuros } from '@/lib/trip';
import type { ProjectData } from './useProject';

/** Checklist « qui ramène quoi » et budget partagé. */
export function Orga({ d, reload }: { d: ProjectData; reload: () => void }) {
  const { me, members, toast } = useApp();
  const pr = d.project!;
  const nameOf = (id: string | null) => members.find(m => m.id === id)?.first_name ?? 'quelqu’un';
  const [label, setLabel] = useState('');
  const [assignee, setAssignee] = useState('');
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [shared, setShared] = useState(true);

  async function run(op: PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await op;
    if (error) toast("Ça n'a pas marché, réessaie."); else { if (ok) toast(ok); reload(); }
  }
  const sb = supabaseBrowser;

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    run(sb().from('project_items').insert({ project_id: pr.id, label: label.trim(), assignee: assignee || null }));
    setLabel('');
  }

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseEuros(amount);
    if (!cents) { toast('Montant invalide : écris par exemple 45 ou 12,50.'); return; }
    run(sb().from('project_expenses').insert({ project_id: pr.id, label: what.trim(), amount_cents: cents, shared }), 'Dépense ajoutée');
    setWhat(''); setAmount('');
  }

  const b = budget(d.expenses.map(e => ({ paidBy: e.paid_by, cents: e.cents, shared: e.shared })), members.map(m => m.id));
  const total = d.expenses.reduce((s, e) => s + e.cents, 0);

  return (
    <div className="block" style={{ gap: 22 }}>
      <div className="block">
        <h3>Qui ramène quoi</h3>
        <div className="list">
          {d.items.length ? d.items.map(it => (
            <div key={it.id} className="item">
              <input type="checkbox" checked={it.done} style={{ width: 22, minHeight: 22, flex: 'none' }} aria-label={`Fait : ${it.label}`}
                onChange={() => run(sb().from('project_items').update({ done: !it.done }).eq('id', it.id))} />
              <div className="grow" style={{ textDecoration: it.done ? 'line-through' : undefined, opacity: it.done ? .6 : 1 }}>
                <b>{it.label}</b>
              </div>
              <select aria-label={`Qui s'en occupe : ${it.label}`} value={it.assignee ?? ''} style={{ width: 'auto', minHeight: 36, padding: '4px 8px', fontSize: 13 }}
                onChange={e => run(sb().from('project_items').update({ assignee: e.target.value || null }).eq('id', it.id))}>
                <option value="">Personne</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name}</option>)}
              </select>
              <ConfirmButton label="×" onConfirm={() => run(sb().from('project_items').delete().eq('id', it.id))} />
            </div>
          )) : <div className="empty">Rien pour l&apos;instant : la tente, le jeu de cartes, la crème solaire…</div>}
        </div>
        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={addItem}>
          <input aria-label="Quoi ramener" required maxLength={100} value={label} onChange={e => setLabel(e.target.value)} placeholder="La crème solaire" />
          <select aria-label="Qui s'en occupe" value={assignee} onChange={e => setAssignee(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Qui ?</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name}</option>)}
          </select>
          <button className="btn sm" type="submit">Ajouter</button>
        </form>
      </div>

      <div className="block">
        <h3>Budget</h3>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted small">Total des dépenses</span><b>{fmtEuros(total)}</b>
          </div>
          <div className="list">
            {members.map(m => (
              <div key={m.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 6 }}><Dot p={m} size={22} />{m.first_name}</span>
                <span className="small">coût : <b>{fmtEuros(b.cost[m.id] ?? 0)}</b></span>
              </div>
            ))}
          </div>
          {b.transfers.length > 0 ? (
            <div className="notice">
              <b>Pour être quittes :</b>
              {b.transfers.map(t => <div key={t.from + t.to}>{nameOf(t.from)} donne {fmtEuros(t.cents)} à {nameOf(t.to)}</div>)}
            </div>
          ) : d.expenses.some(e => e.shared) && <div className="small muted">Tout le monde est quitte.</div>}
          <p className="small muted" style={{ margin: 0 }}>
            Le coût de chacun = sa part des dépenses partagées + ses dépenses perso (son billet d&apos;avion ou de train, par exemple).
          </p>
        </div>

        <div className="list">
          {d.expenses.map(e => (
            <div key={e.id} className="item">
              <Dot p={members.find(m => m.id === e.paid_by)} size={26} />
              <div className="grow">
                <b>{e.label}</b>
                <div className="small muted">payé par {nameOf(e.paid_by)} · {e.shared ? 'partagé' : 'perso'}</div>
              </div>
              <b style={{ whiteSpace: 'nowrap' }}>{fmtEuros(e.cents)}</b>
              {e.paid_by === me.id && <ConfirmButton label="×" onConfirm={() => run(sb().from('project_expenses').delete().eq('id', e.id))} />}
            </div>
          ))}
        </div>

        <form className="card" onSubmit={addExpense}>
          <b>J&apos;ai payé…</b>
          <div className="grid2">
            <label htmlFor="ex-what">Quoi<input id="ex-what" required maxLength={80} value={what} onChange={e => setWhat(e.target.value)} placeholder="La location" /></label>
            <label htmlFor="ex-amount">Combien (€)<input id="ex-amount" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="120" /></label>
          </div>
          <div className="chips" role="group" aria-label="Pour qui">
            <button type="button" className="chip" aria-pressed={shared} onClick={() => setShared(true)}>Partagé entre tous</button>
            <button type="button" className="chip" aria-pressed={!shared} onClick={() => setShared(false)}>Juste pour moi (transport…)</button>
          </div>
          <button className="btn flame" type="submit">Ajouter la dépense</button>
        </form>
      </div>
    </div>
  );
}
