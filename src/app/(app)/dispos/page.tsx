'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { SlotCard } from '@/components/bits';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { commonSlots } from '@/lib/slots';
import { DAY_MS, dayKey, fmtDay, fmtTime, zonedToUtc } from '@/lib/time';

export default function Dispos() {
  const { me, members, byId, avails, groupId, now, reload, toast } = useApp();
  const [date, setDate] = useState(() => dayKey(Date.now(), me.timezone));
  const [from, setFrom] = useState('18:00');
  const [to, setTo] = useState('19:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const slots = useMemo(() => commonSlots(avails.map(a => ({ userId: a.user_id, start: Math.max(a.start, now), end: a.end }))), [avails, now]);
  const upcoming = avails.filter(a => a.end > now);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const start = zonedToUtc(date, from, me.timezone);
    let end = zonedToUtc(date, to, me.timezone);
    if (end <= start) end += DAY_MS; // « de 23h à 1h » : on finit le lendemain
    if (end < Date.now()) { toast('Ce créneau est déjà passé.'); return; }
    setBusy(true);
    const { error } = await supabaseBrowser().from('availabilities').insert({
      group_id: groupId, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), note: note.trim(),
    });
    setBusy(false);
    if (error) { toast("Ça n'a pas marché, réessaie dans un instant."); return; }
    setNote('');
    toast('Dispo ajoutée');
    reload('avails');
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('availabilities').delete().eq('id', id);
    if (error) toast("Ça n'a pas marché, réessaie."); else { toast('Dispo retirée'); reload('avails'); }
  }

  return (
    <section className="tab">
      <div className="block">
        <h1>Je suis dispo…</h1>
        <form className="card" onSubmit={add}>
          <div className="grid3">
            <label htmlFor="d-date">Le<input id="d-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
            <label htmlFor="d-from">De<input id="d-from" type="time" required value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label htmlFor="d-to">À<input id="d-to" type="time" required value={to} onChange={e => setTo(e.target.value)} /></label>
          </div>
          <label htmlFor="d-note">
            Pour quoi faire (facultatif)
            <input id="d-note" maxLength={80} value={note} onChange={e => setNote(e.target.value)} placeholder="Visio, appel, juste papoter…" />
          </label>
          <div className="small muted">
            Heures de {me.city || 'chez toi'}. Les autres les verront converties dans leur heure à eux.
          </div>
          <button className="btn flame" type="submit" disabled={busy}>{busy ? 'Ajout…' : 'Ajouter ma dispo'}</button>
        </form>
      </div>

      <div className="block">
        <h3>Créneaux communs</h3>
        <div className="list">
          {slots.length ? slots.slice(0, 12).map(s => (
            <SlotCard key={`${s.start}-${s.users.join()}`} slot={s} me={me} byId={byId}
              everyone={members.length > 1 && s.users.length === members.length} />
          )) : (
            <div className="empty">
              Pas encore de créneau commun. Dès que deux d&apos;entre vous se chevauchent d&apos;au moins 15 minutes, il apparaît ici.
            </div>
          )}
        </div>
      </div>

      <div className="block">
        <h3>Toutes les dispos à venir</h3>
        <div className="list">
          {upcoming.length ? upcoming.map(a => {
            const p = byId[a.user_id];
            if (!p) return null;
            const other = p.timezone !== me.timezone;
            return (
              <div key={a.id} className="item">
                <Dot p={p} size={28} zoom />
                <div className="grow">
                  <b>{fmtDay(a.start, me.timezone)}, {fmtTime(a.start, me.timezone)} – {fmtTime(a.end, me.timezone)}</b>
                  <div className="small muted">
                    {p.first_name}
                    {other && ` (${fmtTime(a.start, p.timezone)} – ${fmtTime(a.end, p.timezone)} chez ${p.first_name})`}
                    {a.note && ' · ' + a.note}
                  </div>
                </div>
                {a.user_id === me.id && <ConfirmButton label="Retirer" onConfirm={() => remove(a.id)} />}
              </div>
            );
          }) : <div className="empty">Aucune dispo à venir.</div>}
        </div>
      </div>
    </section>
  );
}
