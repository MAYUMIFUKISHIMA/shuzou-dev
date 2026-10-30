export function validateRecord(record) {
 if (!record.lot.trim()) return '仕込み番号を入力してください。';
 if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Number.isFinite(Date.parse(record.date)) || new Date(record.date).toISOString().slice(0,10) !== record.date) return '有効な作業日を入力してください。';
 if (!['仕込み', '発酵管理', '蒸留'].includes(record.process)) return '工程を選択してください。';
 if (record.quantity !== '' && (!Number.isFinite(Number(record.quantity)) || Number(record.quantity) < 0)) return '数量は0以上の数値にしてください。';
 return '';
}
