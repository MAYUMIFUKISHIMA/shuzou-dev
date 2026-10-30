// Excel-safe UTF-8 CSV. JSON companion preserves original values for machine reimport.
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function recordsCsv(records) {
  const columns = [
    "id",
    "owner_id",
    "revision",
    "created_at",
    "updated_at",
    "deleted_at",
    "lot",
    "date",
    "process",
    "quantity",
    "note",
  ];
  return (
    "\uFEFF" +
    [
      columns,
      ...records.map((r) => columns.map((c) => r[c] ?? r.payload?.[c] ?? "")),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
