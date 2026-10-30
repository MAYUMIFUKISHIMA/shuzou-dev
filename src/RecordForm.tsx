import { useState } from "react";
import type { Payload } from "./cloud";
import { validateRecord } from "./record.mjs";
export const emptyRecord = (): Payload => ({
  lot: "",
  date: new Date().toLocaleDateString("sv-SE"),
  process: "仕込み",
  quantity: "",
  note: "",
});
export function RecordForm({
  initial,
  save,
  label = "端末に一時保存",
  disabled = false,
}: {
  initial?: Payload;
  save: (p: Payload) => Promise<void>;
  label?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial ?? emptyRecord());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const issue = validateRecord(value);
        if (issue) {
          setError(issue);
          return;
        }
        setBusy(true);
        setError("");
        try {
          await save(value);
          if (!initial) setValue(emptyRecord());
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存できません");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || disabled}>
        <label>
          作業日
          <input
            required
            type="date"
            value={value.date}
            onChange={(e) => setValue({ ...value, date: e.target.value })}
          />
        </label>
        <label>
          仕込み番号
          <input
            required
            maxLength={80}
            value={value.lot}
            onChange={(e) => setValue({ ...value, lot: e.target.value })}
          />
        </label>
        <label>
          工程
          <select
            value={value.process}
            onChange={(e) => setValue({ ...value, process: e.target.value })}
          >
            {["仕込み", "発酵管理", "蒸留"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          数量（仮項目）
          <input
            type="number"
            min="0"
            step="any"
            value={value.quantity}
            onChange={(e) => setValue({ ...value, quantity: e.target.value })}
          />
        </label>
        <label>
          作業メモ
          <textarea
            rows={3}
            maxLength={2000}
            value={value.note}
            onChange={(e) => setValue({ ...value, note: e.target.value })}
          />
        </label>
        <button type="submit" className="primary">
          {busy ? "処理中…" : label}
        </button>
      </fieldset>
      <p role="alert">{error}</p>
    </form>
  );
}
