import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, recordsCsv } from "../src/export.mjs";
test("CSV quotes, multiline and formula neutralization", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const input of ["=1+1", " +SUM(A1)", "@cmd", "-1", "\ttext", "\r=1"])
    assert.ok(csvCell(input).startsWith("\"'"));
  assert.equal(csvCell("仕込み"), '"仕込み"');
  assert.ok(
    recordsCsv([
      { id: "x", revision: 2, payload: { lot: "TEST", note: "=1" } },
    ]).startsWith("\uFEFF"),
  );
});
