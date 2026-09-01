import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { STATUSES, formatDateTime, labelFor } from '../data/constants'

export default function TicketDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [ticket, setTicket] = useState(null)
  const [updates, setUpdates] = useState([])
  const [supportAgents, setSupportAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [statusDraft, setStatusDraft] = useState('')
  const [assigneeDraft, setAssigneeDraft] = useState('')
  const [note, setNote] = useState('')

  const isStaffRole = ['support', 'supervisor', 'superadmin'].includes(profile?.role)
  const isSupervisorLike = ['supervisor', 'superadmin'].includes(profile?.role)
  const isOwner = ticket?.created_by === user?.id
  const cameFromQueue = location.state?.origin === 'queue'

  // Supervisor/Super Admin yang membuka TIKET BUATANNYA SENDIRI lewat
  // menu "Tiket Saya" cukup diperlakukan seperti Pelapor biasa — cukup
  // kotak "Informasi Tambahan", bukan form pengelolaan penuh (Status,
  // Ditugaskan ke, Catatan Perbaikan). Kalau tiket yang sama dibuka
  // lewat Antrian Support, form pengelolaan penuh tetap ditampilkan
  // karena mereka sedang bertindak sebagai staf yang menangani antrian.
  const showManagementForm = isStaffRole && !(isSupervisorLike && isOwner && !cameFromQueue)
  const showCommentBox = isOwner && !showManagementForm

  const load = useCallback(async () => {
    setLoading(true)
    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .select(
        '*, categories(name), companies(name), reporter:profiles!tickets_created_by_fkey(full_name, whatsapp_number), assignee:profiles!tickets_assigned_to_fkey(full_name, whatsapp_number)'
      )
      .eq('id', id)
      .single()

    if (ticketError) {
      setError('Tiket tidak ditemukan atau Anda tidak memiliki akses.')
      setLoading(false)
      return null
    }

    setTicket(ticketData)
    setStatusDraft(ticketData.status)
    setAssigneeDraft(ticketData.assigned_to || '')

    const { data: updatesData } = await supabase
      .from('ticket_updates')
      .select('*, profiles(full_name, role)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    setUpdates(updatesData || [])

    setLoading(false)
    return ticketData
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (showManagementForm) {
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['support', 'supervisor', 'superadmin'])
        .then(({ data }) => setSupportAgents(data || []))
    }
  }, [showManagementForm])

  async function handleSupportSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Buka tab kosong SEKARANG JUGA — langsung sebagai respons klik
    // pengguna (sinkron), supaya tidak diblokir pop-up blocker browser.
    // Diarahkan ke WhatsApp belakangan setelah perubahan tersimpan &
    // penerima yang tepat ditentukan — atau ditutup lagi kalau ternyata
    // tidak ada nomor WhatsApp yang bisa dituju.
    const waWindow = window.open('', '_blank')

    const statusChanged = statusDraft !== ticket.status
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: statusDraft,
        assigned_to: assigneeDraft || null,
      })
      .eq('id', ticket.id)

    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      if (waWindow) waWindow.close()
      return
    }

    if (statusChanged || note.trim()) {
      await supabase.from('ticket_updates').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        note: note.trim() || null,
        status_from: statusChanged ? ticket.status : null,
        status_to: statusChanged ? statusDraft : null,
      })
    }

    const savedNote = note.trim()
    setNote('')

    const freshTicket = await load()

    // Siapa yang dikirimi notifikasi WhatsApp:
    // - Kalau nama pengguna yang login SAMA dengan nama pelapor tiket
    //   ini (mis. Supervisor mengelola tiket buatannya sendiri lewat
    //   Antrian Support) → kirim ke PIC yang ditugaskan.
    // - Kalau BERBEDA (staf mengelola tiket milik orang lain, kasus
    //   paling umum) → kirim ke pelapor, sebagai notifikasi progress.
    const isSelfReporter =
      !!profile?.full_name && profile.full_name === freshTicket?.reporter?.full_name
    const target = isSelfReporter ? freshTicket?.assignee : freshTicket?.reporter
    const targetNumber = target?.whatsapp_number

    if (targetNumber && waWindow && freshTicket) {
      const message = [
        `*Update Tiket: ${freshTicket.ticket_number}*`,
        `Judul: ${freshTicket.title}`,
        `Perusahaan: ${freshTicket.companies?.name || ''}`,
        `Pelapor: ${freshTicket.reporter?.full_name || '—'}`,
        `Ditugaskan ke: ${freshTicket.assignee?.full_name || 'Belum ditugaskan'}`,
        `Status: ${labelFor(STATUSES, freshTicket.status)}`,
        savedNote ? `Catatan: ${savedNote}` : null,
        '',
        `Lihat detail: ${window.location.origin}/tickets/${freshTicket.id}`,
      ]
        .filter(Boolean)
        .join('\n')

      waWindow.location.href = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`
    } else if (waWindow) {
      waWindow.close()
    }

    setSaving(false)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    await supabase.from('ticket_updates').insert({
      ticket_id: ticket.id,
      user_id: user.id,
      note: note.trim(),
      status_from: null,
      status_to: null,
    })
    setNote('')
    setSaving(false)
    await load()
  }

  if (loading) return <LoadingSpinner label="Memuat detail tiket..." />

  if (error && !ticket) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink-light">{error}</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">Kembali</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-ink-light hover:text-ink">
        ← Kembali
      </button>

      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-brand-600">{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="font-display text-xl font-bold text-ink">{ticket.title}</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-light">{ticket.description}</p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-light">Kategori</dt>
              <dd className="font-medium text-ink">{ticket.categories?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Perusahaan</dt>
              <dd className="font-medium text-ink">{ticket.companies?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Lokasi</dt>
              <dd className="font-medium text-ink">{ticket.location || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">ID Aset</dt>
              <dd className="font-medium text-ink">{ticket.asset_identifier || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Pelapor</dt>
              <dd className="font-medium text-ink">{ticket.reporter?.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Ditugaskan ke</dt>
              <dd className="font-medium text-ink">{ticket.assignee?.full_name || 'Belum ditugaskan'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Dibuat</dt>
              <dd className="font-medium text-ink">{formatDateTime(ticket.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Diperbarui</dt>
              <dd className="font-medium text-ink">{formatDateTime(ticket.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-light">Selesai</dt>
              <dd className="font-medium text-ink">{formatDateTime(ticket.resolved_at)}</dd>
            </div>
          </dl>
        </div>

        <div className="ticket-perf mx-6" />

        {/* Timeline */}
        <div className="p-6">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">Riwayat Aktivitas</h2>
          {updates.length === 0 ? (
            <p className="text-sm text-ink-light">Belum ada aktivitas.</p>
          ) : (
            <ul className="space-y-4">
              {updates.map((u) => (
                <li key={u.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold text-ink">{u.profiles?.full_name}</span>{' '}
                      {u.status_to ? (
                        <span className="text-ink-light">
                          mengubah status menjadi <StatusBadge status={u.status_to} />
                        </span>
                      ) : (
                        <span className="text-ink-light">menambahkan catatan</span>
                      )}
                    </p>
                    {u.note && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-light">{u.note}</p>}
                    <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(u.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aksi perbaikan (Support, Supervisor, Super Admin) */}
        {showManagementForm && (
          <form onSubmit={handleSupportSave} className="border-t border-gray-100 bg-brand-50/40 p-6">
            <h2 className="mb-3 font-display text-sm font-bold text-ink">Perbarui Tiket</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Status</label>
                <select className="input" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ditugaskan ke</label>
                <select className="input" value={assigneeDraft} onChange={(e) => setAssigneeDraft(e.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {supportAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}{a.id === user.id ? ' (Saya)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Catatan Perbaikan (opsional)</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="cth. Sudah dicek, mengganti komponen X, menunggu spare part..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <p className="mt-3 text-xs text-ink-light">
              Setelah tersimpan, WhatsApp mungkin terbuka otomatis di tab baru ke pelapor (atau
              ke PIC kalau Anda sendiri pelapornya) dengan pesan sudah terisi — tinggal periksa
              &amp; klik Kirim di sana.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}

        {/* Kotak informasi tambahan untuk pemilik tiket (Pelapor biasa,
            atau Supervisor/Super Admin yang membuka tiket buatannya
            sendiri lewat "Tiket Saya", bukan dari Antrian Support) */}
        {showCommentBox && (
          <form onSubmit={handleAddComment} className="border-t border-gray-100 p-6">
            <label className="label">Tambahkan Informasi Tambahan</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="cth. Masalah masih terjadi setelah dicoba ulang..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={saving || !note.trim()} className="btn-secondary">
                {saving ? 'Mengirim...' : 'Kirim Catatan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
