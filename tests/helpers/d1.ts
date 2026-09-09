// A minimal D1Database stand-in backed by node:sqlite.
//
// SCOPE: this exercises SQLite semantics and the real migration files, which is where
// the SQL in src/db.ts actually lives. It does NOT exercise workerd, so it will not
// catch D1-specific divergence -- notably RETURNING support and whether batch() is
// genuinely transactional on the hosted service. Re-check both against a real D1
// instance after the first remote migration (see docs/SETUP.md).
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";

const MIGRATIONS_DIR=new URL("../../migrations/",import.meta.url).pathname;

type SqlValue=null|number|bigint|string|Uint8Array;
function rowsFrom(stmt:any,params:unknown[]){return stmt.all(...(params as SqlValue[])) as Record<string,unknown>[];}

class Stmt {
  constructor(private db:DatabaseSync,private sql:string,private params:unknown[]=[]){}
  bind(...params:unknown[]){return new Stmt(this.db,this.sql,params);}
  async first<T=Record<string,unknown>>(column?:string):Promise<T|null>{
    const rows=rowsFrom(this.db.prepare(this.sql),this.params);
    if(!rows.length)return null;
    const row=rows[0];
    return (column?(row as any)[column]:row) as T;
  }
  async all<T=Record<string,unknown>>(){
    const results=rowsFrom(this.db.prepare(this.sql),this.params) as T[];
    return {results,success:true,meta:{}};
  }
  async run(){
    // node:sqlite refuses .run() on statements that return rows, and .all() on some
    // that do not; try the row-returning path first so RETURNING clauses work.
    try{
      const results=rowsFrom(this.db.prepare(this.sql),this.params);
      return {results,success:true,meta:{changes:results.length}};
    }catch{
      const info=this.db.prepare(this.sql).run(...(this.params as SqlValue[])) as any;
      return {results:[],success:true,meta:{changes:Number(info?.changes??0),last_row_id:Number(info?.lastInsertRowid??0)}};
    }
  }
  raw(){return this.all();}
}

export interface TestDb { db:any; sqlite:DatabaseSync; close():void }

export function makeDb(...migrations:string[]):TestDb{
  const sqlite=new DatabaseSync(":memory:");
  const files=migrations.length?migrations:readdirSync(MIGRATIONS_DIR).filter(f=>f.endsWith(".sql")).sort();
  for(const file of files) sqlite.exec(readFileSync(join(MIGRATIONS_DIR,file),"utf8"));
  const db={
    prepare:(sql:string)=>new Stmt(sqlite,sql),
    async batch(stmts:Stmt[]){const out=[];for(const s of stmts)out.push(await s.run());return out;},
    async exec(sql:string){sqlite.exec(sql);return {count:0,duration:0};},
    dump:async()=>new ArrayBuffer(0)
  };
  return {db,sqlite,close:()=>sqlite.close()};
}

export function migrationFiles(){
  return readdirSync(MIGRATIONS_DIR).filter(f=>f.endsWith(".sql")).sort();
}
