import { useOwnerMode } from '../../contexts/OwnerModeContext'

// Bungkus tombol ubah/hapus/dsb yang cuma boleh dipakai di Mode Pemilik.
// Karyawan (mode terkunci) lihat ikon gembok sebagai gantinya.
export default function AksiPemilik({ children }) {
  const { unlocked } = useOwnerMode()
  if (!unlocked) {
    return (
      <span style={{ color: '#bbb', fontSize: 16 }} title="Khusus Mode Pemilik">
        🔒
      </span>
    )
  }
  return children
}
