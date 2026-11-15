import Modal from './Modal'

export default function PopupPembaruan({ daftar, onClose }) {
  return (
    <Modal title="📢 Apa yang baru" onClose={onClose}>
      {daftar.length === 0 && <p style={{ color: '#888' }}>Belum ada catatan pembaruan.</p>}
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {daftar.map((e) => (
          <div key={e.versi} style={{ marginBottom: 14 }}>
            <strong style={{ fontSize: 13, color: '#555' }}>{e.tanggal}</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
              {e.item.map((i, n) => (
                <li key={n} style={{ marginBottom: 6 }}>{i.teks}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="btn btn-block" onClick={onClose}>
        👍 Oke, mengerti
      </button>
    </Modal>
  )
}
