import { useAuth } from '../../contexts/AuthContext'

// Bungkus tombol ubah/hapus/dsb yang cuma boleh dipakai oleh akun pemilik.
// Karyawan (login peran 'karyawan') lihat ikon gembok sebagai gantinya.
// Server (RLS) yang menegakkan batasan ini sungguhan — komponen ini cuma sinkron tampilan.
export default function AksiPemilik({ children }) {
  const { profil } = useAuth()
  if (profil?.peran !== 'pemilik') {
    return (
      <span style={{ color: '#bbb', fontSize: 16 }} title="Khusus Pemilik">
        🔒
      </span>
    )
  }
  return children
}
