// Filter periode Dari~Sampai + tombol pintas (Hari Ini, Kemarin, 7 Hari, Bulan Ini, Bulan Lalu, Semua).
// Tombol cuma mengisi Dari/Sampai — tanggal tetap bisa dipilih manual buat periode bebas.

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daftarPintas() {
  const h = new Date()
  const y = h.getFullYear()
  const m = h.getMonth()
  const d = h.getDate()
  return [
    ['Hari Ini', iso(h), iso(h)],
    ['Kemarin', iso(new Date(y, m, d - 1)), iso(new Date(y, m, d - 1))],
    ['7 Hari', iso(new Date(y, m, d - 6)), iso(h)],
    ['Bulan Ini', iso(new Date(y, m, 1)), iso(h)],
    ['Bulan Lalu', iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))],
    ['Semua', '', ''],
  ]
}

export default function FilterPeriode({ dari, sampai, onChange, children }) {
  const pintas = daftarPintas()
  return (
    <>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        {pintas.map(([label, d, s]) => {
          const aktif = dari === d && sampai === s
          return (
            <button
              key={label}
              type="button"
              className="btn btn-sm"
              style={{ background: aktif ? '#2563eb' : '#ddd', color: aktif ? 'white' : '#333' }}
              onClick={() => onChange(d, s)}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Dari:</label>
        <input type="date" value={dari} onChange={(e) => onChange(e.target.value, sampai)} style={{ width: 150 }} />
        <label>Sampai:</label>
        <input type="date" value={sampai} onChange={(e) => onChange(dari, e.target.value)} style={{ width: 150 }} />
        {children}
      </div>
    </>
  )
}
