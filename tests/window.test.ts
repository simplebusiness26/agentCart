import {beforeEach,describe,expect,it} from 'vitest';
import {WINDOW_MS,getDashboard,getDashboardWindows,insertEvent,saveShop} from '../src/db';
import {fakeEnv} from './helpers/env';
import {makeDb} from './helpers/d1';
import type {Env,PixelEventPayload} from '../src/types';

const SHOP='demo.myshopify.com';
const NOW=Date.parse('2026-09-09T12:00:00.000Z');
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,'tok');});

const at=(ms:number,over:Partial<PixelEventPayload>={}):PixelEventPayload=>({
  shop:SHOP,eventId:`e${ms}${over.eventType||''}`,eventType:'page_viewed',
  occurredAt:new Date(ms).toISOString(),sessionId:`s${ms}`,...over});

describe('window boundaries',()=>{
  it('is half-open: includes the cutoff, excludes one millisecond before',async()=>{
    const cutoff=NOW-WINDOW_MS;
    await insertEvent(env,at(cutoff-1),'ChatGPT','chatgpt.com');
    await insertEvent(env,at(cutoff),'ChatGPT','chatgpt.com');
    await insertEvent(env,at(cutoff+1),'ChatGPT','chatgpt.com');
    const d:any=await getDashboard(env,SHOP,cutoff,NOW);
    expect(Number(d.summary.events)).toBe(2);
  });

  it('excludes an event at the upper bound',async()=>{
    await insertEvent(env,at(NOW),'ChatGPT','chatgpt.com');
    const d:any=await getDashboard(env,SHOP,NOW-WINDOW_MS,NOW);
    expect(Number(d.summary.events)).toBe(0);
  });

  // The regression this migration exists to prevent: with string comparison against
  // datetime('now','-30 day'), a boundary-day event landed in both windows because
  // 'T' sorts above ' '. Once trends compare two windows, that double-counts.
  it('never counts one event in both the current and previous window',async()=>{
    const boundary=NOW-WINDOW_MS;
    for(const ms of [boundary-1,boundary,boundary+1,NOW-1,NOW-2*WINDOW_MS])
      await insertEvent(env,at(ms),'ChatGPT','chatgpt.com');
    const cur:any=await getDashboard(env,SHOP,boundary,NOW);
    const prev:any=await getDashboard(env,SHOP,NOW-2*WINDOW_MS,boundary);
    const total=sqlite.prepare('select count(*) c from events').get().c;
    expect(Number(cur.summary.events)+Number(prev.summary.events)).toBe(total);
  });

  it('a midnight-boundary ISO timestamp is not wrongly included',async()=>{
    // The exact shape that used to slip through: an event before the cutoff whose
    // ISO string sorts above the space-separated SQLite rendering.
    const cutoff=NOW-WINDOW_MS;
    const dayStart=Date.parse(new Date(cutoff).toISOString().slice(0,10)+'T00:00:00.000Z');
    expect(dayStart).toBeLessThan(cutoff);
    await insertEvent(env,at(dayStart),'ChatGPT','chatgpt.com');
    const d:any=await getDashboard(env,SHOP,cutoff,NOW);
    expect(Number(d.summary.events)).toBe(0);
  });

  it('includes an event stamped exactly now',async()=>{
    await insertEvent(env,at(NOW),'ChatGPT','chatgpt.com');
    const d:any=await getDashboardWindows(env,SHOP,NOW);
    expect(Number(d.summary.events)).toBe(1);
  });

  it('getDashboardWindows still splits the two periods cleanly',async()=>{
    for(const ms of [NOW,NOW-WINDOW_MS,NOW-WINDOW_MS+1,NOW-2*WINDOW_MS+1])
      await insertEvent(env,at(ms),'ChatGPT','chatgpt.com');
    const d:any=await getDashboardWindows(env,SHOP,NOW);
    const total=sqlite.prepare('select count(*) c from events').get().c;
    expect(Number(d.summary.events)+Number(d.previous.events)).toBe(total);
  });

  it('getDashboardWindows returns a previous-period summary',async()=>{
    await insertEvent(env,at(NOW-1000,{eventType:'checkout_completed',orderId:'a',amount:10}),'ChatGPT','chatgpt.com');
    await insertEvent(env,at(NOW-WINDOW_MS-1000,{eventType:'checkout_completed',orderId:'b',amount:99}),'ChatGPT','chatgpt.com');
    const d:any=await getDashboardWindows(env,SHOP,NOW);
    expect(Number(d.summary.revenue)).toBe(10);
    expect(Number(d.previous.revenue)).toBe(99);
  });
});

describe('occurred_ms',()=>{
  it('is populated on insert',async()=>{
    await insertEvent(env,at(NOW-5000),'ChatGPT','chatgpt.com');
    expect(sqlite.prepare('select occurred_ms from events').get().occurred_ms).toBe(NOW-5000);
  });

  it('falls back to arrival time rather than dropping an unparseable timestamp',async()=>{
    await insertEvent(env,{shop:SHOP,eventId:'bad',eventType:'page_viewed',occurredAt:'not-a-date'},'ChatGPT','');
    const row=sqlite.prepare('select occurred_ms from events where event_id=?').get('bad');
    expect(row.occurred_ms).toBeGreaterThan(0);
  });

  it('backfills existing rows in both timestamp formats',()=>{
    // Rows written before 0004 carry only occurred_at, in either rendering.
    const {sqlite:db,close}=makeDb('0001_initial.sql');
    db.exec(`INSERT INTO events(event_id,shop_domain,event_type,occurred_at) VALUES
      ('a','s','page_viewed','2026-08-10T00:00:00.000Z'),
      ('b','s','page_viewed','2026-08-10 00:00:00'),
      ('c','s','page_viewed','garbage')`);
    db.exec(`ALTER TABLE events ADD COLUMN occurred_ms INTEGER;
      UPDATE events SET occurred_ms=CAST(strftime('%s',occurred_at) AS INTEGER)*1000 WHERE occurred_ms IS NULL;`);
    const rows=db.prepare('select event_id,occurred_ms from events order by event_id').all() as any[];
    expect(rows[0].occurred_ms).toBe(Date.parse('2026-08-10T00:00:00.000Z'));
    expect(rows[1].occurred_ms).toBe(Date.parse('2026-08-10T00:00:00.000Z'));
    expect(rows[2].occurred_ms).toBe(null);
    close();
  });
});
