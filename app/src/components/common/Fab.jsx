export default function Fab({ onClick, title = 'Tambah' }) {
  return (
    <button className="fab" onClick={onClick} title={title} aria-label={title} type="button">
      +
    </button>
  )
}
