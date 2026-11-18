import { useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'after-hours-mahjong-demo-v1'
const MIN_FAN = 3
const tiles = [
  ...['萬', '筒', '索'].flatMap((suit, suitIndex) =>
    Array.from({ length: 9 }, (_, index) => ({
      id: `${suitIndex}-${index + 1}`,
      label: `${index + 1}${suit}`,
      tone: suitIndex,
    })),
  ),
  ...['東', '南', '西', '北', '白', '發', '中'].map((label, index) => ({
    id: `honor-${index}`,
    label,
    tone: index > 3 ? 3 : 4,
  })),
]

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      rooms: Array.isArray(saved.rooms) ? saved.rooms : [],
      matches: Array.isArray(saved.matches) ? saved.matches : [],
      players: Array.isArray(saved.players) ? saved.players : [],
    }
  } catch {
    return { rooms: [], matches: [], players: [] }
  }
}

function makeId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function App() {
  const [data, setData] = useState(readData)
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-user`) || 'null')
    } catch {
      return null
    }
  })
  const [screen, setScreen] = useState('home')
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [modal, setModal] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomSize, setRoomSize] = useState(4)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [matchForm, setMatchForm] = useState({ winnerId: '', fan: 3, score: 30, winType: 'draw', hand: [] })

  function updateData(updater) {
    const next = updater(data)
    setData(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      setError('Penyimpanan browser tidak tersedia. Perubahan hanya tersimpan sementara.')
    }
  }

  const rooms = data.rooms
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId)
  const ownRooms = rooms.filter((room) => room.players.some((player) => player.id === user?.id))
  const leaderboard = useMemo(() => {
    const stats = new Map()
    data.players.forEach((player) => stats.set(player.id, { ...player, wins: 0, losses: 0, points: 0, games: 0 }))
    data.matches.forEach((match) => {
      match.playerIds.forEach((id) => {
        const row = stats.get(id)
        if (row) row.games += 1
      })
      const winner = stats.get(match.winnerId)
      if (winner) {
        winner.wins += 1
        winner.points += match.points
      }
      match.playerIds.filter((id) => id !== match.winnerId).forEach((id) => {
        const loser = stats.get(id)
        if (loser) loser.losses += 1
      })
    })
    return [...stats.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
  }, [data])

  function signIn(name, role) {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Masukkan nama panggilan terlebih dahulu.')
      return
    }
    const existing = data.players.find((player) => player.name.toLowerCase() === cleanName.toLowerCase())
    const nextUser = existing || { id: makeId(), name: cleanName, role }
    setError('')
    if (!existing) updateData((current) => ({ ...current, players: [...current.players, nextUser] }))
    const sessionUser = { ...nextUser, role }
    setUser(sessionUser)
    try {
      localStorage.setItem(`${STORAGE_KEY}-user`, JSON.stringify(sessionUser))
    } catch {
      setError('Sesi tidak dapat disimpan di browser ini.')
    }
  }

  function createRoom(event) {
    event.preventDefault()
    if (!roomName.trim()) return setError('Beri nama untuk room Anda.')
    const room = {
      id: makeId(),
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: roomName.trim(),
      capacity: Number(roomSize),
      hostId: user.id,
      players: [{ id: user.id, name: user.name }],
      activeMatch: false,
      createdAt: new Date().toISOString(),
    }
    setError('')
    updateData((current) => ({ ...current, rooms: [room, ...current.rooms] }))
    setSelectedRoomId(room.id)
    setScreen('room')
    setRoomName('')
    setModal('')
  }

  function joinRoom(room) {
    if (room.players.some((player) => player.id === user.id)) {
      setSelectedRoomId(room.id)
      setScreen('room')
      setModal('')
      return
    }
    if (room.players.length >= room.capacity) return setError('Room ini sudah penuh.')
    const updated = { ...room, players: [...room.players, { id: user.id, name: user.name }] }
    setError('')
    updateData((current) => ({ ...current, rooms: current.rooms.map((item) => item.id === room.id ? updated : item) }))
    setSelectedRoomId(room.id)
    setScreen('room')
    setModal('')
    setNotice(`Anda bergabung ke ${room.name}.`)
  }

  function findRoom(event) {
    event.preventDefault()
    const room = rooms.find((item) => item.code === joinCode.trim().toUpperCase())
    if (!room) return setError('Kode room tidak ditemukan. Periksa kembali kodenya.')
    joinRoom(room)
  }

  function startMatch() {
    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((room) => room.id === selectedRoom.id ? { ...room, activeMatch: true } : room),
    }))
    setMatchForm({ winnerId: '', fan: 3, score: 30, winType: 'draw', hand: [] })
  }

  function updateFan(fan) {
    setMatchForm((current) => ({ ...current, fan: Number(fan), score: Number(fan) * 10 }))
  }

  function toggleTile(tileId) {
    setMatchForm((current) => {
      const found = current.hand.indexOf(tileId)
      if (found >= 0) return { ...current, hand: current.hand.filter((_, index) => index !== found) }
      if (current.hand.length >= 14) return current
      return { ...current, hand: [...current.hand, tileId] }
    })
  }

  function saveMatch(event) {
    event.preventDefault()
    if (!selectedRoom || selectedRoom.hostId !== user.id) return setError('Hanya host yang dapat mencatat hasil match.')
    if (!matchForm.winnerId) return setError('Pilih pemain yang menang.')
    if (selectedRoom.capacity === 4 && matchForm.fan < MIN_FAN) return setError(`Minimum kemenangan adalah ${MIN_FAN} fan.`)
    if (matchForm.hand.length !== 14) return setError('Pilih tepat 14 tiles untuk mencatat tangan pemenang.')
    const points = selectedRoom.capacity === 4 ? matchForm.fan * 10 : Number(matchForm.score)
    if (!Number.isFinite(points) || points <= 0) return setError('Skor harus lebih besar dari 0.')
    const match = {
      id: makeId(),
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      playerIds: selectedRoom.players.map((player) => player.id),
      winnerId: matchForm.winnerId,
      winnerName: selectedRoom.players.find((player) => player.id === matchForm.winnerId)?.name,
      fan: Number(matchForm.fan),
      points,
      winType: matchForm.winType,
      hand: matchForm.hand.map((id) => tiles.find((tile) => tile.id === id)?.label),
      createdAt: new Date().toISOString(),
    }
    setError('')
    updateData((current) => ({
      ...current,
      matches: [match, ...current.matches],
      rooms: current.rooms.map((room) => room.id === selectedRoom.id ? { ...room, activeMatch: false } : room),
    }))
    setNotice('Hasil match tersimpan di leaderboard browser ini.')
  }

  function leaveRoom() {
    setSelectedRoomId(null)
    setScreen('home')
  }

  function logOut() {
    setUser(null)
    try {
      localStorage.removeItem(`${STORAGE_KEY}-user`)
    } catch {
      setError('Tidak dapat menghapus sesi dari penyimpanan browser.')
    }
    setSelectedRoomId(null)
    setScreen('home')
  }

  if (!user) return <Login onSignIn={signIn} error={error} setError={setError} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setScreen('home') }}>
          <span className="brand-mark">夜</span>
          <span>AFTER HOURS<small>MAHJONG CLUB</small></span>
        </a>
        <div className="side-label">MENU</div>
        <nav className="side-nav">
          <button className={screen === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('home')}><span>◫</span> Beranda</button>
          <button className={screen === 'leaderboard' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('leaderboard')}><span>♜</span> Leaderboard</button>
          <button className={screen === 'room' ? 'nav-item active' : 'nav-item'} onClick={() => selectedRoom && setScreen('room')} disabled={!selectedRoom}><span>▦</span> Room aktif</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="profile-card">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy"><strong>{user.name}</strong><span>{user.role === 'admin' ? 'Admin · Demo' : 'Pemain'}</span></div>
          <button className="logout-button" onClick={logOut} title="Keluar" aria-label="Keluar">↗</button>
        </div>
        <div className="sidebar-foot">HONG KONG STYLE · 3 FAN MIN.</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">CLUB / <strong>{screen === 'leaderboard' ? 'LEADERBOARD' : screen === 'room' ? 'ROOM' : 'DASHBOARD'}</strong></div>
          <div className="topbar-right"><span className="demo-pill"><i /> DEMO LOKAL</span><span className="date-text">HONG KONG · 4 SEATS</span></div>
        </header>
        <div className="content">
          <div className="demo-notice"><span>ⓘ</span><div><strong>Mode demo, data tersimpan di browser ini.</strong> Belum sinkron antar perangkat. Login dan peran di sini hanya untuk mencoba.</div></div>
          {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup">×</button></div>}
          {screen === 'home' && <Dashboard
            user={user}
            rooms={rooms}
            ownRooms={ownRooms}
            matches={data.matches}
            leaderboard={leaderboard}
            onCreate={() => { setError(''); setModal('create') }}
            onJoin={() => { setError(''); setModal('join') }}
            onOpenRoom={(room) => { setSelectedRoomId(room.id); setScreen('room') }}
            onLeaderboard={() => setScreen('leaderboard')}
          />}
          {screen === 'leaderboard' && <Leaderboard leaderboard={leaderboard} matches={data.matches} />}
          {screen === 'room' && selectedRoom && <RoomView
            room={selectedRoom}
            user={user}
            matches={data.matches.filter((match) => match.roomId === selectedRoom.id)}
            form={matchForm}
            setForm={setMatchForm}
            onStart={startMatch}
            onSave={saveMatch}
            onToggleTile={toggleTile}
            onFanChange={updateFan}
            onLeave={leaveRoom}
          />}
        </div>
      </main>

      {modal === 'create' && <Modal title="Buat room baru" onClose={() => setModal('')}>
        <form className="form-stack" onSubmit={createRoom}>
          <label>Nama room<input autoFocus maxLength="36" placeholder="Contoh: Friday Night Table" value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label>
          <label>Jumlah pemain<select value={roomSize} onChange={(event) => setRoomSize(event.target.value)}><option value="2">2 pemain</option><option value="3">3 pemain</option><option value="4">4 pemain</option></select></label>
          <p className="form-note">Anda otomatis menjadi host. Bagikan kode room agar teman bergabung.</p>
          <button className="button primary full" type="submit">Buat room <span>→</span></button>
        </form>
      </Modal>}
      {modal === 'join' && <Modal title="Gabung ke room" onClose={() => setModal('')}>
        <form className="form-stack" onSubmit={findRoom}>
          <label>Kode undangan<input autoFocus maxLength="6" className="code-input" placeholder="A1B2C3" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} /></label>
          <p className="form-note">Di mode demo, buat pengguna lain dengan keluar lalu masuk memakai nama berbeda.</p>
          <button className="button primary full" type="submit">Cari room <span>→</span></button>
        </form>
      </Modal>}
    </div>
  )
}

function Login({ onSignIn, error, setError }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('player')
  return <div className="login-page">
    <div className="login-decoration decor-one">🀄</div><div className="login-decoration decor-two">東</div>
    <header className="login-brand"><span className="brand-mark">夜</span><span>AFTER HOURS<small>MAHJONG CLUB</small></span></header>
    <div className="login-card">
      <div className="eyebrow"><span /> SEAT AT THE TABLE</div>
      <h1>Permainan terbaik<br />dimulai <em>setelah jam kerja.</em></h1>
      <p className="login-subtitle">Catat setiap match. Kejar posisi teratas. Jaga skor tetap jujur.</p>
      <form className="form-stack login-form" onSubmit={(event) => { event.preventDefault(); onSignIn(name, role) }}>
        <label>Nama panggilan<input autoFocus placeholder="Masukkan nama Anda" maxLength="24" value={name} onChange={(event) => { setName(event.target.value); setError('') }} /></label>
        <label>Masuk sebagai<select value={role} onChange={(event) => setRole(event.target.value)}><option value="player">Pemain</option><option value="admin">Admin (demo)</option></select></label>
        {error && <div className="inline-error">{error}</div>}
        <button className="button primary full" type="submit">Masuk ke meja <span>→</span></button>
      </form>
      <div className="login-divider"><span /> ATURAN MEJA <span /></div>
      <div className="login-rules"><span>Hong Kong Mahjong</span><span>Minimum 3 fan</span><span>2–4 pemain</span></div>
    </div>
    <footer className="login-footer">BUILT FOR THE LATE-NIGHT TABLE <span>✦</span> MODE DEMO LOKAL</footer>
  </div>
}

function Dashboard({ user, rooms, ownRooms, matches, leaderboard, onCreate, onJoin, onOpenRoom, onLeaderboard }) {
  const playerStats = leaderboard.find((player) => player.id === user.id) || { wins: 0, losses: 0, points: 0, games: 0 }
  return <>
    <section className="welcome-row">
      <div><div className="eyebrow">RABU MALAM · MEJA TERBUKA</div><h1>Selamat malam, <em>{user.name}.</em></h1><p>Siapkan meja. Teman-teman sudah menunggu.</p></div>
      <div className="welcome-actions"><button className="button secondary" onClick={onJoin}>↗ <span>Gabung room</span></button><button className="button primary" onClick={onCreate}>＋ <span>Buat room</span></button></div>
    </section>
    <section className="stats-grid">
      <StatCard label="TOTAL POIN" value={playerStats.points} icon="♜" meta="Akumulasi dari semua room" />
      <StatCard label="MATCH DIMAINKAN" value={playerStats.games} icon="▣" meta={`${playerStats.wins} menang · ${playerStats.losses} kalah`} />
      <StatCard label="WIN RATE" value={`${playerStats.games ? Math.round((playerStats.wins / playerStats.games) * 100) : 0}%`} icon="↗" meta="Dari seluruh match tercatat" />
      <StatCard label="ROOM TERSEDIA" value={rooms.length} icon="◫" meta="Tersimpan di browser ini" />
    </section>
    <div className="section-heading"><div><div className="eyebrow">MEJA ANDA</div><h2>Room saya <span className="count-badge">{ownRooms.length}</span></h2></div><button className="text-button" onClick={onJoin}>Gabung dengan kode <span>→</span></button></div>
    {ownRooms.length ? <div className="room-grid">{ownRooms.map((room) => <RoomCard key={room.id} room={room} onClick={() => onOpenRoom(room)} />)}</div> : <div className="empty-card"><div className="empty-symbol">🀄</div><h3>Meja pertama Anda dimulai di sini.</h3><p>Buat room baru atau gabung dengan kode undangan teman.</p><div><button className="button primary" onClick={onCreate}>＋ Buat room</button><button className="button secondary" onClick={onJoin}>Gabung room</button></div></div>}
    <div className="lower-grid">
      <section className="panel leaderboard-preview">
        <div className="panel-heading"><div><div className="eyebrow">GLOBAL · DEMO LOKAL</div><h2>Pemain teratas</h2></div><button className="text-button" onClick={onLeaderboard}>Lihat semua →</button></div>
        {leaderboard.length ? leaderboard.slice(0, 4).map((player, index) => <div className="mini-player" key={player.id}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><span className="avatar small">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><span className="mini-wins">{player.wins}W / {player.losses}L</span><b>{player.points}<small> pts</small></b></div>) : <div className="panel-empty">Skor pertama akan muncul setelah match selesai.</div>}
      </section>
      <section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">RIWAYAT MEJA</div><h2>Match terakhir</h2></div><span className="live-dot" /></div>
        {matches.length ? matches.slice(0, 4).map((match) => <div className="recent-match" key={match.id}><div className="match-icon">♟</div><div><strong>{match.winnerName} menang</strong><span>{match.roomName} · {match.fan} fan</span></div><b>+{match.points}</b></div>) : <div className="panel-empty">Belum ada match. Hasil permainan akan tercatat di sini.</div>}
      </section>
    </div>
    {user.role === 'admin' && <div className="admin-note">ADMIN DEMO · {rooms.length} room · {leaderboard.length} pemain · {matches.length} match tercatat di browser ini.</div>}
  </>
}

function StatCard({ label, value, icon, meta }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><small>{meta}</small></div>
}

function RoomCard({ room, onClick }) {
  return <button className="room-card" onClick={onClick}><div className="room-card-top"><span className="room-status"><i /> {room.activeMatch ? 'MATCH BERLANGSUNG' : 'MEJA TERBUKA'}</span><span className="room-arrow">↗</span></div><h3>{room.name}</h3><div className="room-card-meta"><span>HOST <b>{room.players.find((player) => player.id === room.hostId)?.name || '—'}</b></span><span>KODE <b>{room.code}</b></span></div><div className="room-seats">{Array.from({ length: room.capacity }, (_, index) => <span className={index < room.players.length ? 'seat filled' : 'seat'} key={index}>{index < room.players.length ? room.players[index].name.slice(0, 1).toUpperCase() : '+'}</span>)}<small>{room.players.length} / {room.capacity} PEMAIN</small></div></button>
}

function Leaderboard({ leaderboard, matches }) {
  const top = leaderboard[0]
  return <section className="leaderboard-page">
    <div className="page-title"><div className="eyebrow">GLOBAL RANKING · DATA BROWSER INI</div><h1>Semua <em>pemain.</em></h1><p>Setiap tile dihitung. Setiap kemenangan meninggalkan jejak.</p></div>
    {top && <div className="champion-banner"><div><div className="eyebrow">♛ PEMIMPIN SAAT INI</div><h2>{top.name}</h2><p>{top.wins} kemenangan dari {top.games} match</p></div><div className="champion-score">{top.points}<small> POIN</small></div><div className="champion-tile">發</div></div>}
    <div className="panel ranking-panel"><div className="ranking-head"><span>RANK / PEMAIN</span><span>MATCH</span><span>MENANG</span><span>KALAH</span><span>POIN</span></div>
      {leaderboard.length ? leaderboard.map((player, index) => <div className="ranking-row" key={player.id}><div className="ranking-name"><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><span className="avatar small">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong>{player.id === top?.id && <span className="leader-tag">TOP</span>}</div><span>{player.games}</span><span className="win-value">{player.wins}</span><span>{player.losses}</span><strong>{player.points}</strong></div>) : <div className="panel-empty">Belum ada pemain. Mainkan match pertama untuk mengisi leaderboard.</div>}
    </div>
    <div className="leaderboard-foot">Berdasarkan {matches.length} match tercatat · Poin adalah poin leaderboard demo, bukan tabel pembayaran resmi Hong Kong Mahjong.</div>
  </section>
}

function RoomView({ room, user, matches, form, setForm, onStart, onSave, onToggleTile, onFanChange, onLeave }) {
  const isHost = user.id === room.hostId
  return <section className="room-view">
    <button className="back-link" onClick={onLeave}>← Kembali ke beranda</button>
    <div className="room-title-row"><div><div className="eyebrow"><span className="room-status"><i /> ROOM AKTIF</span> · HOST {room.players.find((player) => player.id === room.hostId)?.name?.toUpperCase()}</div><h1>{room.name}</h1><p>Kode undangan <b className="inline-code">{room.code}</b> <span>·</span> {room.capacity} kursi</p></div><button className="button secondary" onClick={() => navigator.clipboard?.writeText(room.code)}>▣ Salin kode</button></div>
    <div className="room-layout"><div className="room-main-column">
      <section className="panel seats-panel"><div className="panel-heading"><div><div className="eyebrow">SUSUNAN MEJA</div><h2>Pemain <span className="count-badge">{room.players.length}/{room.capacity}</span></h2></div><span className="turn-indicator"><i /> {room.activeMatch ? 'MATCH BERLANGSUNG' : 'MENUNGGU MULAI'}</span></div><div className="player-seats">{room.players.map((player, index) => <div className="player-seat" key={player.id}><div className={`seat-avatar seat-tone-${index}`}>{player.name.slice(0, 1).toUpperCase()}</div><strong>{player.name}</strong><span>{player.id === room.hostId ? '♛ HOST' : `SEAT ${index + 1}`}</span></div>)}{Array.from({ length: room.capacity - room.players.length }, (_, index) => <div className="player-seat waiting" key={index}><div className="seat-avatar">＋</div><strong>Menunggu</strong><span>KODE {room.code}</span></div>)}</div>
        {isHost && !room.activeMatch && <div className="host-action"><span>Pastikan semua pemain sudah bergabung sebelum memulai.</span><button className="button primary" disabled={room.players.length < room.capacity} onClick={onStart}>Mulai match <span>→</span></button></div>}
        {!isHost && <div className="guest-note">Host room ini yang akan memulai permainan dan mengonfirmasi hasil.</div>}
      </section>
      {room.activeMatch && isHost && <form className="panel score-panel" onSubmit={onSave}>
        <div className="panel-heading"><div><div className="eyebrow">CATAT HASIL · HOST</div><h2>Siapa yang menang?</h2></div><span className="match-live"><i /> LIVE</span></div>
        <div className="winner-options">{room.players.map((player) => <button type="button" className={form.winnerId === player.id ? 'winner-option selected' : 'winner-option'} key={player.id} onClick={() => setForm((current) => ({ ...current, winnerId: player.id }))}><span className="avatar small">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong>{form.winnerId === player.id && <span className="checkmark">✓</span>}</button>)}</div>
        <div className="score-fields">
          {room.capacity === 4 ? <label>FAN MENANG<small>Minimum {MIN_FAN} fan sesuai aturan meja</small><select value={form.fan} onChange={(event) => onFanChange(event.target.value)}>{Array.from({ length: 11 }, (_, index) => <option value={index + 3} key={index}>{index + 3} fan</option>)}</select></label> : <label>POIN LEADERBOARD<small>Masukkan skor sesuai kesepakatan meja</small><input type="number" min="1" value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} /></label>}
          <label>JENIS KEMENANGAN<small>Catatan untuk riwayat match</small><select value={form.winType} onChange={(event) => setForm((current) => ({ ...current, winType: event.target.value }))}><option value="draw">Self-draw (menang sendiri)</option><option value="discard">Menang dari discard</option></select></label>
        </div>
        {room.capacity === 4 && <div className="score-calculation"><span>POIN LEADERBOARD</span><strong>{form.fan} fan × 10 = {form.fan * 10} poin</strong><small>Konversi poin demo; host mengonfirmasi fan. Bukan tabel settlement resmi.</small></div>}
        <div className="tile-picker-heading"><div><h3>Tangan pemenang</h3><p>Pilih 14 tiles sebagai catatan tangan kemenangan.</p></div><span>{form.hand.length} / 14</span></div>
        <div className="selected-tiles" aria-label="Tiles terpilih">{form.hand.length ? form.hand.map((id, index) => { const tile = tiles.find((item) => item.id === id); return <button type="button" className={`tile selected-tile tone-${tile?.tone}`} key={`${id}-${index}`} onClick={() => onToggleTile(id)} title="Hapus tile">{tile?.label}</button> }) : <span className="empty-hand">Pilih tiles di bawah untuk mencatat tangan pemenang.</span>}</div>
        <div className="tile-grid">{tiles.map((tile) => <button type="button" className={`tile tone-${tile.tone} ${form.hand.includes(tile.id) ? 'tile-picked' : ''}`} key={tile.id} onClick={() => onToggleTile(tile.id)} title={`Pilih ${tile.label}`}>{tile.label}</button>)}</div>
        <button className="button primary full save-result" type="submit">Konfirmasi & catat hasil <span>→</span></button>
      </form>}
      {room.activeMatch && !isHost && <div className="panel waiting-panel"><div className="waiting-pulse">♟</div><h2>Match sedang berlangsung</h2><p>Tunggu host mencatat dan mengonfirmasi hasil permainan.</p></div>}
      {!room.activeMatch && <section className="panel recent-panel room-history"><div className="panel-heading"><div><div className="eyebrow">CATATAN MEJA</div><h2>Riwayat match</h2></div></div>{matches.length ? matches.slice(0, 8).map((match) => <div className="recent-match" key={match.id}><div className="match-icon">♟</div><div><strong>{match.winnerName} menang</strong><span>{match.fan} fan · {match.winType === 'draw' ? 'Self-draw' : 'Discard'}</span></div><b>+{match.points}</b></div>) : <div className="panel-empty">Belum ada hasil match untuk room ini.</div>}</section>}
    </div>
    <aside className="room-side-column"><div className="panel rules-panel"><div className="eyebrow">ATURAN MEJA</div><h3>Hong Kong<br />Mahjong</h3><div className="rule-line"><span>Minimum fan</span><strong>3 fan</strong></div><div className="rule-line"><span>Jumlah pemain</span><strong>{room.capacity} pemain</strong></div><div className="rule-line"><span>Host</span><strong>{room.players.find((player) => player.id === room.hostId)?.name}</strong></div><div className="rules-warning">Poin × 10 adalah konversi leaderboard demo, bukan settlement Hong Kong resmi. Host tetap bertanggung jawab memverifikasi aturan fan meja.</div></div>
      <div className="panel invite-panel"><div className="eyebrow">UNDANG PEMAIN</div><h3>Bagikan kode meja.</h3><p>Pemain bisa masuk lewat tombol Gabung room di halaman beranda.</p><div className="large-code">{room.code}</div></div>
    </aside></div>
  </section>
}

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Tutup">×</button></div>{children}</section></div>
}

export default App
