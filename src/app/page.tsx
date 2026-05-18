'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, Resource, Hotline, TYPE_META, RESOURCE_TYPES, HOTLINE_CATEGORIES, STATES } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────
type View = 'resources' | 'hotlines'
type Modal = 'none' | 'crisis' | 'resource' | 'hotline' | 'share' | 'suggest' | 'login' | 'settings'

const PAGE_SIZE = 30

const HOTLINE_SECTION_STYLE: Record<string, string> = {
  Crisis:           'bg-red-700',
  Emergency:        'bg-red-600',
  'Veteran Services': 'bg-navy',
  'Mental Health':  'bg-teal-700',
  Healthcare:       'bg-teal-600',
  Legal:            'bg-purple-700',
  'Senior Services':'bg-gray-600',
  'Social Services':'bg-gray-500',
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function App() {
  // Data
  const [resources, setResources]   = useState<Resource[]>([])
  const [hotlines, setHotlines]     = useState<Hotline[]>([])
  const [counties, setCounties]     = useState<string[]>([])
  const [loading, setLoading]       = useState(true)

  // Filters
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [countyFilter, setCountyFilter] = useState('')
  const [sortBy, setSortBy]         = useState('pinned')
  const [page, setPage]             = useState(1)

  // UI
  const [view, setView]             = useState<View>('resources')
  const [modal, setModal]           = useState<Modal>('none')
  const [isAdmin, setIsAdmin]       = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  // Edit state
  const [editResource, setEditResource] = useState<Partial<Resource> | null>(null)
  const [editHotline, setEditHotline]   = useState<Partial<Hotline> | null>(null)
  const [shareTarget, setShareTarget]   = useState<Resource | null>(null)

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll()
    // Check if already logged in via session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsAdmin(true)
        setAdminEmail(data.session.user.email ?? '')
      }
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session)
      setAdminEmail(session?.user.email ?? '')
    })
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: res }, { data: hot }] = await Promise.all([
      supabase.from('resources').select('*').order('pinned', { ascending: false }).order('name'),
      supabase.from('hotlines').select('*').order('category').order('name'),
    ])
    if (res) setResources(res)
    if (hot) setHotlines(hot)
    if (res) {
      const allCounties = Array.from(new Set(res.map(r => r.county).filter(Boolean))).sort()
      setCounties(allCounties)
    }
    setLoading(false)
  }

  // ─── Filtered resources ──────────────────────────────────────────────────────
  const filtered = useCallback(() => {
    const q = search.toLowerCase()
    let list = resources.filter(r => {
      if (typeFilter && r.type !== typeFilter) return false
      if (stateFilter && r.state !== stateFilter) return false
      if (countyFilter && r.county !== countyFilter) return false
      if (q) {
        const hay = [r.name, r.city, r.county, r.phone, r.address, r.notes, r.type]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (sortBy === 'pinned') {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'county') return (a.county || '').localeCompare(b.county || '')
      if (sortBy === 'type')   return a.type.localeCompare(b.type)
      return a.name.localeCompare(b.name)
    })
    return list
  }, [resources, search, typeFilter, stateFilter, countyFilter, sortBy])

  const results   = filtered()
  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const pageItems  = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch(''); setTypeFilter(''); setStateFilter(''); setCountyFilter('')
    setPage(1); scrollRef.current?.scrollTo(0, 0)
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
  async function doLogin(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    setModal('none')
    return null
  }

  async function doLogout() {
    await supabase.auth.signOut()
    setIsAdmin(false); setAdminEmail('')
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────
  async function saveResource(data: Partial<Resource>) {
    if (!data.name) return
    const payload = {
      name: data.name, type: data.type || 'Community', state: data.state || 'MO',
      county: data.county || '', city: data.city || '', phone: data.phone || '',
      address: data.address || '', notes: data.notes || '', pinned: data.pinned || false,
      updated_by: adminEmail,
    }
    if (data.id) {
      await supabase.from('resources').update(payload).eq('id', data.id)
      await logAudit('update', 'resources', data.id, data.name ?? '')
    } else {
      const { data: inserted } = await supabase.from('resources').insert(payload).select().single()
      if (inserted) await logAudit('insert', 'resources', inserted.id, data.name ?? '')
    }
    setModal('none'); loadAll()
  }

  async function deleteResource(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from('resources').delete().eq('id', id)
    await logAudit('delete', 'resources', id, name)
    setModal('none'); loadAll()
  }

  async function togglePin(r: Resource) {
    await supabase.from('resources').update({ pinned: !r.pinned, updated_by: adminEmail }).eq('id', r.id)
    await logAudit('pin', 'resources', r.id, r.name)
    loadAll()
  }

  async function saveHotline(data: Partial<Hotline>) {
    if (!data.name || !data.phone) return
    const payload = { name: data.name, phone: data.phone, state: data.state || 'Both', category: data.category || 'Crisis', notes: data.notes || '' }
    if (data.id) {
      await supabase.from('hotlines').update(payload).eq('id', data.id)
    } else {
      await supabase.from('hotlines').insert(payload)
    }
    setModal('none'); loadAll()
  }

  async function deleteHotline(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from('hotlines').delete().eq('id', id)
    setModal('none'); loadAll()
  }

  async function logAudit(action: string, table: string, id: string, name: string) {
    await supabase.from('audit_log').insert({ action, table_name: table, record_id: id, record_name: name, changed_by: adminEmail })
  }

  // ─── Share ───────────────────────────────────────────────────────────────────
  async function shareResource(r: Resource, method: 'email' | 'sms', contact: string) {
    const body = `Veterans Resource: ${r.name}\nType: ${r.type}\nPhone: ${r.phone}\nAddress: ${r.address}${r.city ? ', ' + r.city : ''}${r.county ? ', ' + r.county + ' County' : ''}${r.notes ? '\nNotes: ' + r.notes : ''}\n\nFrom: Veterans Resource Directory — John J. Pershing VA`
    await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, contact, resource: r, text: body }),
    })
    setModal('none')
    alert(`Sent to ${contact}`)
  }

  // ─── Print ───────────────────────────────────────────────────────────────────
  function printCounty() {
    if (!countyFilter) { alert('Select a county first using the county filter.'); return }
    const res = resources.filter(r => r.county === countyFilter)
    const grouped: Record<string, Resource[]> = {}
    res.forEach(r => { if (!grouped[r.type]) grouped[r.type] = []; grouped[r.type].push(r) })
    const html = `<html><head><title>${countyFilter} County Resources</title>
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
    <style>body{font-family:'Source Sans 3',sans-serif;font-size:9pt;color:#111;}
    h1{font-family:'Oswald',sans-serif;font-size:16pt;margin:0;}
    .hdr{background:#0F2347;color:#fff;padding:12px 16px;margin-bottom:4px;}
    .gold{background:#C8941A;height:3px;margin-bottom:12px;}
    .cat{background:#1B3A6B;color:#fff;padding:4px 10px;font-family:'Oswald',sans-serif;font-size:9pt;letter-spacing:.07em;margin:8px 0 0;border-radius:3px 3px 0 0;}
    table{width:100%;border-collapse:collapse;font-size:8pt;}
    th{background:#254e91;color:#fff;padding:4px 8px;text-align:left;}
    td{padding:4px 8px;border-bottom:1px solid #eee;}
    tr:nth-child(even)td{background:#F8F9FF;}
    .pin{color:#C8941A;font-weight:700;}
    footer{font-size:7pt;color:#888;margin-top:12px;border-top:1px solid #ddd;padding-top:6px;}
    @media print{body{margin:0;}}</style></head><body>
    <div class="hdr"><h1>🇺🇸 ${countyFilter} County — Veterans Resources</h1>
    <p style="font-size:8pt;opacity:.7;margin:3px 0 0">${res[0]?.state || ''} · John J. Pershing VA Medical Center · ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p></div>
    <div class="gold"></div>
    ${Object.entries(grouped).sort().map(([type, items]) => `
      <div class="cat">${TYPE_META[type]?.icon || ''} ${type.toUpperCase()} (${items.length})</div>
      <table><thead><tr><th width="28%">Name</th><th width="14%">City</th><th width="16%">Phone</th><th width="24%">Address</th><th>Notes</th></tr></thead>
      <tbody>${items.sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<tr><td>${r.pinned?'<span class="pin">⭐ </span>':''}${r.name}</td><td>${r.city||''}</td><td><strong>${r.phone||''}</strong></td><td>${r.address||''}</td><td style="font-size:7pt;font-style:italic;color:#92400E;">${r.notes||''}</td></tr>`).join('')}</tbody></table>`).join('')}
    <footer>Always call ahead to verify hours and availability. John J. Pershing VA Medical Center, Poplar Bluff MO.</footer>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────
  function openModal(m: Modal) { setModal(m) }
  function closeModal() { setModal('none') }

  const crisisHotlines = hotlines.filter(h => ['Crisis', 'Emergency', 'Veteran Services'].includes(h.category))

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F2F4F8]">

      {/* ── HEADER ── */}
      <header id="app-header" className="flex-shrink-0 z-40"
        style={{ background: 'linear-gradient(135deg, #0F2347 0%, #1B3A6B 70%, #254e91 100%)', boxShadow: '0 3px 12px rgba(0,0,0,.35)' }}>

        {/* Top row */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-b-2 border-[#C8941A]">
          <span className="text-3xl leading-none flex-shrink-0">🇺🇸</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-white text-sm uppercase tracking-wide leading-tight">Veterans Resource Directory</h1>
            <p className="text-[0.65rem] text-[#F0C84A] opacity-80 mt-0.5">John J. Pershing VA · Poplar Bluff, MO</p>
          </div>
          <button onClick={() => isAdmin ? doLogout() : openModal('login')}
            className={`text-xs px-3 py-1.5 rounded-md border font-body transition-all flex-shrink-0 ${isAdmin
              ? 'bg-amber-800 border-amber-700 text-white'
              : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}>
            {isAdmin ? '🛡️ Admin' : '🔒 Staff'}
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2 px-3 py-2">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#F0C84A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search name, city, phone…" autoComplete="off" autoCorrect="off" spellCheck={false}
              className="w-full pl-8 pr-3 py-2 rounded-lg border-2 border-white/15 bg-white/10 text-white placeholder-white/35 font-body text-sm outline-none focus:border-[#C8941A] focus:bg-white/18 transition-all" />
          </div>
          <button onClick={clearFilters} className="px-3 py-2 rounded-lg border-2 border-white/18 text-white/60 text-xs font-body whitespace-nowrap active:bg-white/10 transition-all">✕ Clear</button>
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
          {[{ label: 'All', value: '' }, ...RESOURCE_TYPES.map(t => ({ label: `${TYPE_META[t].icon} ${t}`, value: t }))].map(chip => (
            <button key={chip.value} onClick={() => { setTypeFilter(chip.value); setPage(1); scrollRef.current?.scrollTo(0, 0) }}
              className={`chip flex-shrink-0 px-2.5 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all font-body ${
                typeFilter === chip.value
                  ? 'bg-[#C8941A] border-[#C8941A] text-[#0F2347] font-semibold'
                  : 'bg-white/8 border-white/20 text-white/75'}`}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* State + County */}
        <div className="flex gap-2 px-3 pb-2">
          {[
            { id: 'state', value: stateFilter, label: 'All States', options: STATES.map(s => ({ v: s, l: s === 'MO' ? 'Missouri' : 'Arkansas' })), onChange: (v: string) => { setStateFilter(v); setCountyFilter(''); setPage(1) } },
            { id: 'county', value: countyFilter, label: 'All Counties', options: counties.filter(c => !stateFilter || resources.some(r => r.county === c && r.state === stateFilter)).map(c => ({ v: c, l: c })), onChange: (v: string) => { setCountyFilter(v); setPage(1) } },
          ].map(sel => (
            <select key={sel.id} value={sel.value} onChange={e => sel.onChange(e.target.value)}
              className="flex-1 px-2.5 py-2 rounded-lg border-2 border-white/15 bg-white/10 text-white font-body text-xs outline-none focus:border-[#C8941A] transition-all cursor-pointer"
              style={{ colorScheme: 'dark' }}>
              <option value="" style={{ background: '#0F2347' }}>{sel.label}</option>
              {sel.options.map(o => <option key={o.v} value={o.v} style={{ background: '#0F2347' }}>{o.l}</option>)}
            </select>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-[#0F2347]">
          {([['resources', '📋 Resources'], ['hotlines', '📞 Hotlines']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); scrollRef.current?.scrollTo(0, 0) }}
              className={`flex-1 py-2.5 font-display text-xs tracking-widest uppercase border-b-[3px] transition-all ${
                view === v ? 'text-[#F0C84A] border-[#C8941A]' : 'text-white/40 border-transparent'}`}>
              {label}
            </button>
          ))}
          <button onClick={printCounty} className="flex-[0.55] py-2.5 font-display text-xs tracking-widest uppercase text-white/40 border-b-[3px] border-transparent">
            🖨️ Print
          </button>
        </div>

        {/* Admin banner */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-gradient-to-r from-amber-900 to-amber-800">
            <span className="font-display text-white text-xs tracking-wide">🛡️ ADMIN MODE</span>
            <span className="text-white/60 text-xs">{adminEmail}</span>
            <div className="ml-auto flex gap-1.5 flex-wrap">
              <button onClick={() => { setEditResource({}); openModal('resource') }} className="px-2.5 py-1 rounded text-xs bg-white/15 text-white border border-white/25 active:bg-white/25">➕ {view === 'hotlines' ? 'Hotline' : 'Resource'}</button>
              <button onClick={() => openModal('settings')} className="px-2.5 py-1 rounded text-xs bg-white/15 text-white border border-white/25 active:bg-white/25">⚙️ Settings</button>
            </div>
          </div>
        )}
      </header>

      {/* ── SCROLL AREA ── */}
      <div ref={scrollRef} className="flex-1 scroll-area overflow-y-auto pb-24">

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-navy/20 border-t-[#C8941A] animate-spin" />
            <p className="text-sm text-gray-400 font-body">Loading resources…</p>
          </div>
        )}

        {/* ── RESOURCES VIEW ── */}
        {!loading && view === 'resources' && (
          <>
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="font-display text-[#1B3A6B] text-sm font-semibold">
                {results.length} <span className="text-[#C8941A]">results</span>
              </span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600 font-body outline-none cursor-pointer">
                <option value="pinned">⭐ Pinned first</option>
                <option value="name">A – Z</option>
                <option value="county">By county</option>
                <option value="type">By type</option>
              </select>
            </div>

            {pageItems.length === 0 ? (
              <div className="text-center py-16 px-5">
                <div className="text-5xl mb-3">🔍</div>
                <h3 className="font-display text-gray-700 text-base mb-1">No results found</h3>
                <p className="text-gray-400 text-sm">Try different search terms or clear your filters.</p>
                <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-[#1B3A6B] text-white rounded-lg text-sm font-body">Clear filters</button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100">
                {pageItems.map(r => (
                  <div key={r.id} className={`card-tap bg-white px-3.5 py-3 relative ${r.pinned ? 'border-l-4 border-l-amber-400 pl-3' : ''}`}>
                    {r.pinned && <div className="absolute top-0 right-2.5 bg-amber-400 text-white text-[0.5rem] font-display font-bold px-2 py-0.5 rounded-b-md tracking-wider">⭐ PINNED</div>}
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-xl leading-none mt-0.5 flex-shrink-0">{TYPE_META[r.type]?.icon || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold text-[#1B3A6B] text-sm leading-tight">{r.name}</div>
                        <span className={`inline-block text-[0.58rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-0.5 ${TYPE_META[r.type]?.badge || 'bg-gray-100 text-gray-600'}`}>{r.type}</span>
                      </div>
                    </div>
                    {(r.city || r.county) && (
                      <p className="text-xs text-gray-400 ml-7 mb-1">📍 {[r.city, r.county, r.state].filter(Boolean).join(', ')}</p>
                    )}
                    {r.phone && (
                      <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`}
                        className="ml-7 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F2F4F8] border border-gray-200 text-[#1B3A6B] font-semibold text-sm active:bg-[#1B3A6B] active:text-white transition-all">
                        📞 {r.phone}
                      </a>
                    )}
                    {r.address && <p className="text-xs text-gray-400 ml-7 mt-1">🏢 {r.address}</p>}
                    {r.notes && (
                      <div className="ml-7 mt-1.5 text-xs text-amber-800 bg-amber-50 border-l-2 border-amber-400 px-2 py-1 rounded-r">📝 {r.notes}</div>
                    )}
                    <div className="ml-7 mt-2 flex gap-1.5">
                      <button onClick={() => { setShareTarget(r); openModal('share') }}
                        className="px-2.5 py-1 rounded text-xs bg-[#1B3A6B]/10 text-[#1B3A6B] font-body active:bg-[#1B3A6B] active:text-white transition-all">
                        📤 Share
                      </button>
                      {isAdmin && <>
                        <button onClick={() => togglePin(r)} className="px-2.5 py-1 rounded text-xs bg-amber-50 text-amber-700 font-body active:bg-amber-500 active:text-white transition-all">
                          {r.pinned ? '★ Unpin' : '⭐ Pin'}
                        </button>
                        <button onClick={() => { setEditResource(r); openModal('resource') }} className="px-2.5 py-1 rounded text-xs bg-gray-100 text-gray-600 font-body active:bg-gray-300 transition-all">
                          ✏️ Edit
                        </button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-1.5 py-4 px-3 flex-wrap">
                <button onClick={() => { setPage(p => Math.max(1, p - 1)); scrollRef.current?.scrollTo(0, 0) }}
                  disabled={page === 1} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm disabled:opacity-30">← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, i, arr) => (
                  <span key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-300 px-1">…</span>}
                    <button onClick={() => { setPage(p); scrollRef.current?.scrollTo(0, 0) }}
                      className={`min-w-[38px] py-2 rounded-lg border text-sm font-body ${p === page ? 'bg-[#1B3A6B] text-white border-[#1B3A6B] font-bold' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {p}
                    </button>
                  </span>
                ))}
                <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); scrollRef.current?.scrollTo(0, 0) }}
                  disabled={page === totalPages} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm disabled:opacity-30">Next →</button>
              </div>
            )}

            {/* Suggest button */}
            <div className="px-3.5 py-3 text-center">
              <button onClick={() => openModal('suggest')} className="text-sm text-[#1B3A6B] underline underline-offset-2 font-body">
                Know a resource we're missing? Suggest it →
              </button>
            </div>
          </>
        )}

        {/* ── HOTLINES VIEW ── */}
        {!loading && view === 'hotlines' && (
          <>
            <div className="px-3.5 py-2.5">
              <p className="text-xs text-gray-500 font-body">Tap any number to call directly.</p>
            </div>
            {HOTLINE_CATEGORIES.map(cat => {
              const items = hotlines.filter(h => h.category === cat)
              if (!items.length) return null
              return (
                <div key={cat}>
                  <div className={`px-3.5 py-2 font-display text-xs font-bold tracking-widest uppercase text-white mt-1.5 ${HOTLINE_SECTION_STYLE[cat] || 'bg-gray-600'}`}>
                    {cat}
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100">
                    {items.map(h => (
                      <div key={h.id} className="bg-white px-3.5 py-3 flex justify-between items-center gap-3 border-l-4" style={{ borderLeftColor: cat === 'Crisis' || cat === 'Emergency' ? '#DC2626' : cat === 'Veteran Services' ? '#1B3A6B' : cat === 'Legal' ? '#7C3AED' : '#0D9488' }}>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 text-sm leading-tight font-body">{h.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{h.state === 'Both' ? 'MO & AR' : h.state}{h.notes ? ` · ${h.notes}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isAdmin && (
                            <button onClick={() => { setEditHotline(h); openModal('hotline') }} className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded font-body">✏️</button>
                          )}
                          <a href={`tel:${h.phone.replace(/[^0-9+]/g, '')}`}
                            className="font-display font-semibold text-[#1B3A6B] text-sm px-3 py-2 bg-[#F2F4F8] rounded-lg border border-gray-200 active:bg-[#1B3A6B] active:text-white transition-all whitespace-nowrap">
                            {h.phone}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {isAdmin && (
              <div className="p-3.5">
                <button onClick={() => { setEditHotline({}); openModal('hotline') }} className="w-full py-3 rounded-xl bg-[#1B3A6B] text-white font-display tracking-wide text-sm">➕ Add Hotline</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CRISIS FLOAT BUTTON ── */}
      <button id="crisis-btn" onClick={() => openModal('crisis')}
        className="fixed bottom-5 right-3.5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-red-600 text-white font-display text-xs tracking-widest uppercase font-semibold shadow-lg shadow-red-600/40 active:scale-95 transition-all">
        <div className="pulse-dot w-2 h-2 bg-white rounded-full" />
        CRISIS LINES
      </button>

      {/* ── MODALS ── */}
      {modal !== 'none' && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget && modal !== 'login') closeModal() }}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto slide-up shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />

            {/* CRISIS */}
            {modal === 'crisis' && <>
              <ModalHeader title="🆘 Crisis & Emergency Lines" color="bg-red-600" onClose={closeModal} />
              <div className="p-4 flex flex-col divide-y divide-gray-100">
                {crisisHotlines.map(h => (
                  <div key={h.id} className="py-3 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-semibold text-sm font-body">{h.name}</div>
                      <div className="text-xs text-gray-400">{h.state === 'Both' ? 'MO & AR' : h.state} · {h.category}</div>
                    </div>
                    <a href={`tel:${h.phone.replace(/[^0-9+]/g, '')}`} className="px-3 py-2 bg-red-600 text-white rounded-lg font-display text-sm active:bg-red-800 transition-all whitespace-nowrap">
                      📞 {h.phone}
                    </a>
                  </div>
                ))}
              </div>
            </>}

            {/* LOGIN */}
            {modal === 'login' && <>
              <div className="p-5">
                <h2 className="font-display text-xl text-[#1B3A6B] mb-1">Staff Login</h2>
                <p className="text-sm text-gray-500 mb-4 font-body">Sign in to manage resources and hotlines.</p>
                <LoginForm onLogin={doLogin} onCancel={closeModal} />
              </div>
            </>}

            {/* RESOURCE FORM */}
            {modal === 'resource' && editResource !== null && <>
              <ModalHeader title={editResource.id ? '✏️ Edit Resource' : '➕ Add Resource'} color="bg-[#1B3A6B]" onClose={closeModal} />
              <ResourceForm
                initial={editResource}
                counties={counties}
                onSave={saveResource}
                onDelete={editResource.id ? () => deleteResource(editResource.id!, editResource.name!) : undefined}
                onCancel={closeModal}
              />
            </>}

            {/* HOTLINE FORM */}
            {modal === 'hotline' && editHotline !== null && <>
              <ModalHeader title={editHotline.id ? '✏️ Edit Hotline' : '➕ Add Hotline'} color="bg-[#1B3A6B]" onClose={closeModal} />
              <HotlineForm initial={editHotline} onSave={saveHotline} onDelete={editHotline.id ? () => deleteHotline(editHotline.id!, editHotline.name!) : undefined} onCancel={closeModal} />
            </>}

            {/* SHARE */}
            {modal === 'share' && shareTarget && <>
              <ModalHeader title="📤 Share Resource" color="bg-[#1B3A6B]" onClose={closeModal} />
              <ShareForm resource={shareTarget} onShare={shareResource} onCancel={closeModal} />
            </>}

            {/* SUGGEST */}
            {modal === 'suggest' && <>
              <ModalHeader title="💡 Suggest a Resource" color="bg-[#1B3A6B]" onClose={closeModal} />
              <SuggestForm counties={counties} onSubmit={async (data) => {
                await supabase.from('suggestions').insert(data)
                closeModal(); alert('Thank you! Your suggestion has been submitted for review.')
              }} onCancel={closeModal} />
            </>}

            {/* SETTINGS */}
            {modal === 'settings' && isAdmin && <>
              <ModalHeader title="⚙️ Settings" color="bg-amber-800" onClose={closeModal} />
              <SettingsPanel resources={resources} hotlines={hotlines} onClose={closeModal} />
            </>}

          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModalHeader({ title, color, onClose }: { title: string; color: string; onClose: () => void }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${color}`}>
      <h2 className="font-display text-white text-base tracking-wide">{title}</h2>
      <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center text-sm active:bg-white/30">✕</button>
    </div>
  )
}

function LoginForm({ onLogin, onCancel }: { onLogin: (e: string, p: string) => Promise<string | null>; onCancel: () => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw]       = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  async function submit() {
    if (!email || !pw) return
    setLoading(true); setErr('')
    const e = await onLogin(email, pw)
    if (e) { setErr(e); setLoading(false) }
  }
  return (
    <div className="flex flex-col gap-3">
      {err && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg font-body">{err}</div>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 font-body text-sm outline-none focus:border-[#1B3A6B]" />
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Password" className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 font-body text-sm outline-none focus:border-[#1B3A6B]" />
      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-body">Cancel</button>
        <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-body disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    </div>
  )
}

function ResourceForm({ initial, counties, onSave, onDelete, onCancel }:
  { initial: Partial<Resource>; counties: string[]; onSave: (d: Partial<Resource>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Partial<Resource>>(initial)
  const set = (k: keyof Resource, v: unknown) => setD(prev => ({ ...prev, [k]: v }))
  return (
    <div className="p-4 flex flex-col gap-3">
      <Field label="Name *"><input value={d.name || ''} onChange={e => set('name', e.target.value)} placeholder="Organization name" className={fi} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select value={d.type || 'Community'} onChange={e => set('type', e.target.value)} className={fi}>
          {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select></Field>
        <Field label="State"><select value={d.state || 'MO'} onChange={e => set('state', e.target.value)} className={fi}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="County"><select value={d.county || ''} onChange={e => set('county', e.target.value)} className={fi}>
          <option value="">Select…</option>{counties.map(c => <option key={c}>{c}</option>)}
        </select></Field>
        <Field label="City"><input value={d.city || ''} onChange={e => set('city', e.target.value)} className={fi} /></Field>
      </div>
      <Field label="Phone"><input type="tel" value={d.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="555-555-5555" className={fi} /></Field>
      <Field label="Address"><input value={d.address || ''} onChange={e => set('address', e.target.value)} className={fi} /></Field>
      <Field label="Notes"><textarea value={d.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className={fi} /></Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={d.pinned || false} onChange={e => set('pinned', e.target.checked)} className="w-4 h-4" />
        <span className="text-sm font-body text-gray-700">⭐ Pin / Recommend</span>
      </label>
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {onDelete && <button onClick={onDelete} className="px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-body">Delete</button>}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-body">Cancel</button>
        <button onClick={() => onSave(d)} className="flex-1 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-body font-semibold">Save</button>
      </div>
    </div>
  )
}

function HotlineForm({ initial, onSave, onDelete, onCancel }:
  { initial: Partial<Hotline>; onSave: (d: Partial<Hotline>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Partial<Hotline>>(initial)
  const set = (k: keyof Hotline, v: string) => setD(prev => ({ ...prev, [k]: v }))
  return (
    <div className="p-4 flex flex-col gap-3">
      <Field label="Name *"><input value={d.name || ''} onChange={e => set('name', e.target.value)} className={fi} /></Field>
      <Field label="Phone *"><input type="tel" value={d.phone || ''} onChange={e => set('phone', e.target.value)} className={fi} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State"><select value={d.state || 'Both'} onChange={e => set('state', e.target.value)} className={fi}>
          <option value="Both">MO & AR</option><option value="MO">Missouri</option><option value="AR">Arkansas</option>
        </select></Field>
        <Field label="Category"><select value={d.category || 'Crisis'} onChange={e => set('category', e.target.value)} className={fi}>
          {HOTLINE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select></Field>
      </div>
      <Field label="Notes"><input value={d.notes || ''} onChange={e => set('notes', e.target.value)} className={fi} /></Field>
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {onDelete && <button onClick={onDelete} className="px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-body">Delete</button>}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-body">Cancel</button>
        <button onClick={() => onSave(d)} className="flex-1 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-body font-semibold">Save</button>
      </div>
    </div>
  )
}

function ShareForm({ resource, onShare, onCancel }:
  { resource: Resource; onShare: (r: Resource, method: 'email' | 'sms', contact: string) => void; onCancel: () => void }) {
  const [method, setMethod]   = useState<'email' | 'sms'>('email')
  const [contact, setContact] = useState('')
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="bg-[#F2F4F8] rounded-lg p-3">
        <div className="font-semibold text-sm text-[#1B3A6B] font-body">{resource.name}</div>
        <div className="text-xs text-gray-400">{resource.phone}</div>
      </div>
      <div className="flex gap-2">
        {(['email', 'sms'] as const).map(m => (
          <button key={m} onClick={() => setMethod(m)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-body border-2 transition-all ${method === m ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-white text-gray-500 border-gray-200'}`}>
            {m === 'email' ? '📧 Email' : '💬 Text'}
          </button>
        ))}
      </div>
      <input type={method === 'email' ? 'email' : 'tel'} value={contact} onChange={e => setContact(e.target.value)}
        placeholder={method === 'email' ? 'veteran@email.com' : '555-555-5555'}
        className={fi} />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-body">Cancel</button>
        <button onClick={() => contact && onShare(resource, method, contact)} className="flex-1 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-body font-semibold">Send</button>
      </div>
    </div>
  )
}

function SuggestForm({ counties, onSubmit, onCancel }:
  { counties: string[]; onSubmit: (d: Record<string, string>) => void; onCancel: () => void }) {
  const [d, setD] = useState<Record<string, string>>({ type: 'Community', state: 'MO' })
  const set = (k: string, v: string) => setD(prev => ({ ...prev, [k]: v }))
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm text-gray-500 font-body">Know a resource we should add? Fill in what you know — we'll verify and add it.</p>
      <Field label="Organization Name *"><input value={d.name || ''} onChange={e => set('name', e.target.value)} className={fi} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select value={d.type} onChange={e => set('type', e.target.value)} className={fi}>
          {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select></Field>
        <Field label="State"><select value={d.state} onChange={e => set('state', e.target.value)} className={fi}>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="County"><select value={d.county || ''} onChange={e => set('county', e.target.value)} className={fi}>
          <option value="">Select…</option>{counties.map(c => <option key={c}>{c}</option>)}
        </select></Field>
        <Field label="City"><input value={d.city || ''} onChange={e => set('city', e.target.value)} className={fi} /></Field>
      </div>
      <Field label="Phone"><input type="tel" value={d.phone || ''} onChange={e => set('phone', e.target.value)} className={fi} /></Field>
      <Field label="Notes / Hours"><textarea value={d.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className={fi} /></Field>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-body">Cancel</button>
        <button onClick={() => d.name && onSubmit(d)} className="flex-1 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-body font-semibold">Submit</button>
      </div>
    </div>
  )
}

function SettingsPanel({ resources, hotlines, onClose }:
  { resources: Resource[]; hotlines: Hotline[]; onClose: () => void }) {
  const pinned = resources.filter(r => r.pinned).length
  const byType = RESOURCE_TYPES.map(t => ({ t, n: resources.filter(r => r.type === t).length })).filter(x => x.n > 0)
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{ n: resources.length, l: 'Resources' }, { n: hotlines.length, l: 'Hotlines' }, { n: pinned, l: '⭐ Pinned' }].map(s => (
          <div key={s.l} className="bg-[#F2F4F8] rounded-xl p-3 text-center">
            <div className="font-display text-2xl font-bold text-[#1B3A6B]">{s.n}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Type</div>
      <div className="flex flex-col gap-1">
        {byType.sort((a,b) => b.n - a.n).map(x => (
          <div key={x.t} className="flex items-center gap-2">
            <span className="text-xs w-4">{TYPE_META[x.t]?.icon}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1B3A6B] rounded-full" style={{ width: `${(x.n / resources.length) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{x.n}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 font-body">
        <p>To add staff accounts, go to your Supabase dashboard → Authentication → Invite user.</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide font-body">{label}</label>
      {children}
    </div>
  )
}

const fi = "w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 font-body text-sm text-gray-900 outline-none focus:border-[#1B3A6B] transition-all bg-white"
