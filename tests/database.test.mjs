import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Postgres permissions, retries, revisions, restore deadline and archive snapshots", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile("supabase/migrations/202610300001_records.sql", "utf8"),
    );
    const a = "10000000-0000-0000-0000-000000000001",
      b = "10000000-0000-0000-0000-000000000002",
      admin = "10000000-0000-0000-0000-000000000003",
      id = "20000000-0000-0000-0000-000000000001";
    await db.exec(
      `insert into auth.users values('${a}'),('${b}'),('${admin}'); insert into public.profiles values('${a}','worker'),('${b}','worker'),('${admin}','admin');`,
    );
    async function as(user) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      await db.exec("set role authenticated");
    }
    const p = {
      lot: "TEST",
      date: "2026-10-30",
      process: "仕込み",
      quantity: "1",
      note: "",
    };
    await as(a);
    await db.query("select public.submit_record($1,$2)", [id, p]);
    await db.query("select public.submit_record($1,$2)", [id, p]);
    assert.equal(
      (await db.query("select * from public.record_history")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.profiles set role='admin' where id=$1", [a]),
    );
    await assert.rejects(
      db.query("delete from public.work_records where id=$1", [id]),
    );
    await assert.rejects(
      db.query("select public.change_record($1,1,'delete')", [id]),
    );
    await as(b);
    assert.equal(
      (await db.query("select * from public.work_records")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.record_history")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.submit_record($1,$2)", [id, p]),
    );
    await assert.rejects(
      db.query("select public.change_record($1,1,'edit',$2)", [id, p]),
    );
    await assert.rejects(db.query("select public.create_archive()"));
    await as(admin);
    const archive = (await db.query("select public.create_archive() as id"))
      .rows[0].id;
    await db.query("select public.confirm_archive($1)", [archive]);
    await db.query("select public.change_record($1,1,'edit',$2)", [
      id,
      { ...p, note: "revised" },
    ]);
    await assert.rejects(
      db.query("select public.change_record($1,1,'edit',$2)", [id, p]),
    );
    const snapshot = (
      await db.query(
        "select snapshot,confirmed_at from public.archive_exports where id=$1",
        [archive],
      )
    ).rows[0];
    assert.ok(snapshot.confirmed_at);
    assert.equal(snapshot.snapshot.records[0].revision, 1);
    assert.equal(snapshot.snapshot.records[0].payload.note, "");
    await db.query("select public.change_record($1,2,'delete')", [id]);
    await as(a);
    assert.equal(
      (await db.query("select * from public.work_records")).rows.length,
      0,
    );
    await as(admin);
    await db.query("select public.change_record($1,3,'restore')", [id]);
    await db.query("select public.change_record($1,4,'delete')", [id]);
    await db.exec("reset role");
    await db.query(
      "update public.work_records set deleted_at=now()-interval '24 hours' where id=$1",
      [id],
    );
    await as(admin);
    await assert.rejects(
      db.query("select public.change_record($1,5,'restore')", [id]),
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.work_records"));
    await assert.rejects(
      db.query("select public.submit_record($1,$2)", [id, p]),
    );
  } finally {
    await db.close();
  }
});
