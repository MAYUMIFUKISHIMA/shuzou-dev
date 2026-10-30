import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { requireCloud, rpc, type RecordRow, type Archive } from "./cloud";
import {
  queueFor,
  addPending,
  acknowledge,
  discardQueue,
  exclusive,
  type Pending,
} from "./cloud-queue";
import { RecordForm } from "./RecordForm";
import { recordsCsv } from "./export.mjs";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "処理に失敗しました";
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function CloudApp() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const client = requireCloud();
    client.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <>
      <header>
        <span className="brand">蔵の記録</span>
        <span>接続版 · 検証用</span>
      </header>
      <main>
        <div className="notice">
          帳票未確定の検証版です。本番運用前に実機・権限・バックアップを確認してください。
        </div>
        {loading ? (
          <p>読み込み中…</p>
        ) : session ? (
          <Workspace key={session.user.id} session={session} />
        ) : (
          <Login />
        )}
        <p role="alert">{error}</p>
      </main>
    </>
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <h1>ログイン</h1>
      <p>管理者から案内された個人アカウントを使用してください。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { error } = await requireCloud().auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            setPassword("");
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            メールアドレス
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit">ログイン</button>
        </fieldset>
        <p role="alert">{error}</p>
      </form>
    </>
  );
}
function Workspace({ session }: { session: Session }) {
  const owner = session.user.id;
  const [tab, setTab] = useState("入力"),
    [pending, setPending] = useState<Pending[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [foreign, setForeign] = useState(false),
    [admin, setAdmin] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [rows, setRows] = useState<RecordRow[]>([]),
    [page, setPage] = useState(0),
    [date, setDate] = useState(""),
    [author, setAuthor] = useState(""),
    [deleted, setDeleted] = useState(false),
    [editing, setEditing] = useState<RecordRow | null>(null),
    [history, setHistory] = useState<unknown[] | null>(null),
    [archives, setArchives] = useState<Archive[]>([]);
  const active = useRef(true),
    working = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const sync = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await exclusive(async () => {
        const {
          data: { session: current },
        } = await requireCloud().auth.getSession();
        if (current?.user.id !== owner)
          throw new Error("再ログインしてください。");
        const items = await queueFor(owner);
        for (const item of items) {
          if (!active.current) break;
          const accepted = await rpc("submit_record", {
            p_id: item.id,
            p_payload: item.payload,
          });
          if (accepted !== item.id)
            throw new Error(
              "受付確認ができません。記録を保持して再送できます。",
            );
          const remaining = await acknowledge(owner, item.id);
          if (active.current) setPending(remaining);
        }
        if (active.current)
          setMessage(
            "送信処理が完了しました。記録一覧を更新して確認できます。",
          );
      });
    } catch (e) {
      if (active.current)
        setMessage(
          `送信未完了：${errorText(e)} 記録は端末に保持されています。受付済みの可能性があるため、同じIDで再送します。`,
        );
    } finally {
      working.current = false;
      if (active.current) setBusy(false);
    }
  }, [owner]);
  useEffect(() => {
    exclusive(() => queueFor(owner))
      .then((items) => {
        if (active.current) {
          setPending(items);
          setReady(true);
          if (navigator.onLine && items.length) void sync();
        }
      })
      .catch((e) => {
        if (active.current) {
          setMessage(errorText(e));
          setForeign(true);
        }
      });
    requireCloud()
      .from("profiles")
      .select("role")
      .eq("id", owner)
      .single()
      .then(({ data, error }) => {
        if (active.current) {
          if (error)
            setMessage(
              "利用者権限を確認できません。管理者に登録状況を確認してください。",
            );
          setAdmin(data?.role === "admin");
        }
      });
    const connected = () => {
      setOnline(true);
      void sync();
    };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [owner, sync]);
  async function run(fn: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    let q = requireCloud()
      .from("work_records")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 50, page * 50 + 49);
    q = deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    if (date) q = q.eq("payload->>date", date);
    if (author) q = q.eq("owner_id", author);
    const { data, error } = await q.abortSignal(AbortSignal.timeout(15000));
    if (error) throw error;
    setRows(data ?? []);
    setHistory(null);
  }
  async function loadArchives() {
    const { data, error } = await requireCloud()
      .from("archive_exports")
      .select("id,created_at,confirmed_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    setArchives((data ?? []) as Archive[]);
  }
  async function archiveById(id: string) {
    const { data, error } = await requireCloud()
      .from("archive_exports")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Archive;
  }
  return (
    <>
      <section>
        <p>
          {session.user.email} · {admin ? "管理者" : "作業員"}
        </p>
        <p>
          {online ? "接続あり" : "オフライン"} · 未送信：{pending.length}件
        </p>
        <div className="actions">
          <button
            disabled={!ready || busy || !online}
            onClick={() => void sync()}
          >
            未送信分を送信
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (
                !confirm(
                  `未送信${pending.length}件と入力途中の内容を破棄してログアウトしますか？ 送信中断後はサーバーに受付済みの場合があります。`,
                )
              )
                return;
              void run(async () => {
                await exclusive(async () => {
                  await discardQueue();
                  const { error } = await requireCloud().auth.signOut({
                    scope: "local",
                  });
                  if (error) throw error;
                  setPending([]);
                  setRows([]);
                  setHistory(null);
                  setArchives([]);
                });
              });
            }}
          >
            ログアウト・交代
          </button>
        </div>
        {foreign && (
          <button
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "端末に残る前の利用者の未送信データを全て破棄します。よろしいですか？",
                )
              )
                void run(async () => {
                  await exclusive(async () => {
                    await discardQueue();
                    setPending(await queueFor(owner));
                  });
                  setForeign(false);
                  setReady(true);
                });
            }}
          >
            前の利用者のデータを破棄して開始
          </button>
        )}
      </section>
      <nav aria-label="メイン">
        <button onClick={() => setTab("入力")}>記録する</button>
        <button
          onClick={() => {
            setTab("記録");
            void run(refresh);
          }}
        >
          記録一覧
        </button>
        {admin && (
          <button
            onClick={() => {
              setTab("保存");
              void run(loadArchives);
            }}
          >
            CSV・社内保存
          </button>
        )}
      </nav>
      <p role="status">{message}</p>
      {tab === "入力" && (
        <>
          <h1>作業を記録</h1>
          <RecordForm
            disabled={!ready || busy}
            save={async (payload) => {
              await exclusive(async () => {
                setPending(
                  await addPending(owner, { id: crypto.randomUUID(), payload }),
                );
              });
              setMessage("端末に保存しました。未送信分を送信してください。");
            }}
          />
          <p>
            保存前の入力は画面切替で消えます。保存済みデータは再接続時に自動送信し、手動で再送することもできます。
          </p>
          {pending.map((p) => (
            <p key={p.id}>
              {p.payload.date} · {p.payload.lot} · 未送信
            </p>
          ))}
        </>
      )}
      {tab === "記録" && (
        <>
          <h1>記録一覧</h1>
          <section>
            <label>
              作業日で絞る
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {admin && (
              <>
                <label>
                  入力者IDで絞る
                  <input
                    value={author}
                    onChange={(e) => {
                      setAuthor(e.target.value);
                      setPage(0);
                    }}
                    placeholder="一覧に表示される入力者ID"
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={deleted}
                    onChange={(e) => {
                      setDeleted(e.target.checked);
                      setPage(0);
                    }}
                  />
                  削除済みを表示
                </label>
              </>
            )}
            <div className="actions">
              <button disabled={busy} onClick={() => void run(refresh)}>
                一覧を更新
              </button>
              <button
                disabled={page === 0 || busy}
                onClick={() => setPage(page - 1)}
              >
                前ページ
              </button>
              <span>{page + 1}ページ（50件）</span>
              <button
                disabled={rows.length < 50 || busy}
                onClick={() => setPage(page + 1)}
              >
                次ページ
              </button>
            </div>
            <p>条件・ページ変更後は「一覧を更新」を押してください。</p>
          </section>
          {rows.length === 0 && <p>表示する記録はありません。</p>}
          {rows.map((r) => (
            <section key={r.id}>
              <span className="badge">
                {r.deleted_at ? "削除済み" : r.payload.process}
              </span>
              <h2>{r.payload.lot}</h2>
              <p>
                {r.payload.date} · 数量：{r.payload.quantity || "未入力"}
              </p>
              <p className="note">{r.payload.note}</p>
              <p className="note muted">
                入力者ID：{r.owner_id} / 改訂：{r.revision}
              </p>
              {r.deleted_at && (
                <p>
                  復元期限：
                  {new Date(Date.parse(r.deleted_at) + 86400000).toLocaleString(
                    "ja-JP",
                  )}
                </p>
              )}
              <div className="actions">
                {!r.deleted_at && (
                  <button disabled={busy} onClick={() => setEditing(r)}>
                    修正
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const { data, error } = await requireCloud()
                        .from("record_history")
                        .select("*")
                        .eq("record_id", r.id)
                        .order("id");
                      if (error) throw error;
                      setHistory(data);
                    })
                  }
                >
                  変更履歴
                </button>
                {admin && (
                  <button
                    disabled={
                      busy ||
                      Boolean(
                        r.deleted_at &&
                        Date.now() >= Date.parse(r.deleted_at) + 86400000,
                      )
                    }
                    onClick={() => {
                      if (
                        confirm(
                          r.deleted_at
                            ? "復元しますか？"
                            : "削除しますか？24時間以内は復元できます。",
                        )
                      )
                        void run(async () => {
                          await rpc("change_record", {
                            p_id: r.id,
                            p_revision: r.revision,
                            p_action: r.deleted_at ? "restore" : "delete",
                          });
                          await refresh();
                        });
                    }}
                  >
                    {r.deleted_at ? "復元" : "削除"}
                  </button>
                )}
              </div>
            </section>
          ))}
          {editing && (
            <section>
              <h2>記録を修正</h2>
              <RecordForm
                key={editing.id + ":" + editing.revision}
                initial={editing.payload}
                label="修正を保存"
                disabled={busy}
                save={async (payload) => {
                  if (working.current)
                    throw new Error("他の処理が完了するまでお待ちください。");
                  working.current = true;
                  setBusy(true);
                  try {
                    await rpc("change_record", {
                      p_id: editing.id,
                      p_revision: editing.revision,
                      p_action: "edit",
                      p_payload: payload,
                    });
                    setEditing(null);
                    await refresh();
                  } finally {
                    working.current = false;
                    setBusy(false);
                  }
                }}
              />
              <button onClick={() => setEditing(null)}>修正を取消</button>
            </section>
          )}
          {history && (
            <section>
              <h2>変更履歴</h2>
              <pre>{JSON.stringify(history, null, 2)}</pre>
            </section>
          )}
        </>
      )}
      {tab === "保存" && admin && (
        <>
          <h1>CSV・社内保存</h1>
          <p>
            全記録と変更履歴の出力時点を固定します。CSVは閲覧用、JSONは元の値・履歴を保持する保存用です。両方を会社の保存先へ移して確認してください。
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await rpc("create_archive");
                await loadArchives();
                setMessage(
                  "保存用の出力を作成しました。CSVとJSONをダウンロードしてください。",
                );
              })
            }
          >
            全記録の出力を作成
          </button>
          {archives.map((a) => (
            <section key={a.id}>
              <h2>{new Date(a.created_at).toLocaleString("ja-JP")}</h2>
              <p>{a.confirmed_at ? "社内保存確認済み" : "社内保存未確認"}</p>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const item = await archiveById(a.id);
                      download(
                        `records-${a.id}.csv`,
                        recordsCsv(item.snapshot.records),
                        "text/csv;charset=utf-8",
                      );
                    })
                  }
                >
                  CSVをダウンロード
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const item = await archiveById(a.id);
                      download(
                        `archive-${a.id}.json`,
                        JSON.stringify(item, null, 2),
                        "application/json",
                      );
                    })
                  }
                >
                  JSONをダウンロード
                </button>
                <button
                  disabled={busy || !!a.confirmed_at}
                  onClick={() => {
                    if (
                      confirm(
                        "この出力のCSVとJSONを会社の保存先に保存し、開けることを確認しましたか？",
                      )
                    )
                      void run(async () => {
                        await rpc("confirm_archive", { p_id: a.id });
                        await loadArchives();
                      });
                  }}
                >
                  社内保存完了を確認
                </button>
              </div>
            </section>
          ))}
          <p>
            最新版20件を表示。1年経過後の自動削除は、製造完了・混合分割の定義確定後に有効化します。
          </p>
        </>
      )}
    </>
  );
}
