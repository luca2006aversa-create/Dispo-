'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { dayKey, fmtDay, fmtTime } from '@/lib/time';

export default function Chat() {
  const { me, byId, messages, groupId, markChatSeen, reload, toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Si la table du chat n'existe pas (migration pas lancée), on le dit clairement au lieu de rester muet.
  const [broken, setBroken] = useState('');
  useEffect(() => {
    supabaseBrowser().from('messages').select('id', { head: true, count: 'exact' }).eq('group_id', groupId)
      .then(({ error }) => setBroken(error ? `${error.code ?? ''} ${error.message}`.trim() : ''));
  }, [groupId, messages.length]);

  // Tout ce qui est affiché ici compte comme lu.
  useEffect(() => { markChatSeen(); }, [messages, markChatSeen]);

  // Descend au dernier message : d'un coup à l'ouverture, en douceur ensuite.
  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: first.current ? 'instant' : 'smooth' });
    if (messages.length) first.current = false;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from('messages').insert({ group_id: groupId, body });
    setBusy(false);
    if (error) { setBroken(`${error.code ?? ''} ${error.message}`.trim()); toast("Le message n'est pas parti."); return; }
    setText('');
    reload('messages');
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('messages').delete().eq('id', id);
    if (error) toast("Ça n'a pas marché, réessaie."); else reload('messages');
  }

  return (
    <section className="tab chat">
      <h1>Le chat</h1>
      {broken && (
        <div className="card" role="alert">
          <b>Le chat n&apos;est pas encore prêt côté base de données.</b>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Luca : lance le fichier <code>supabase/migrations/20261102000001_chat.sql</code> dans Supabase
            (SQL Editor), puis recharge l&apos;app. Détail : {broken}
          </p>
        </div>
      )}
      <div className="msgs" aria-live="polite">
        {messages.length ? messages.map((m, i) => {
          const who = byId[m.user_id];
          const mine = m.user_id === me.id;
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created, me.timezone) !== dayKey(m.created, me.timezone);
          // On n'affiche la pastille et le prénom qu'au début d'une suite de messages de la même personne.
          const grouped = !newDay && prev?.user_id === m.user_id && m.created - prev.created < 5 * 60_000;
          return (
            <div key={m.id} className="msg-row">
              {newDay && <div className="day-sep">{fmtDay(m.created, me.timezone)}</div>}
              <div className={`msg${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
                {!mine && <span className="msg-dot">{!grouped && <Dot p={who} size={28} zoom />}</span>}
                <div className="bubble">
                  {!mine && !grouped && <b className="small">{who?.first_name ?? 'Quelqu’un'}</b>}
                  <div className="body">{m.body}</div>
                  <span className="time">
                    {fmtTime(m.created, me.timezone)}
                    {mine && <ConfirmButton label="Suppr." onConfirm={() => remove(m.id)} />}
                  </span>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="empty">Pas encore de message. Lance la conversation !</div>
        )}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={send}>
        <label htmlFor="chat-input" className="visually-hidden">Ton message</label>
        <textarea id="chat-input" rows={1} maxLength={1000} value={text} placeholder="Écris un message…"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
        <button className="btn flame" type="submit" disabled={busy || !text.trim()} aria-label="Envoyer">➤</button>
      </form>
    </section>
  );
}
