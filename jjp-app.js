/* JJP Resource Directory — Static App Logic */

var DATA = JJP_DATA || {resources:[],hotlines:[],nursing_homes:[],care_homes:[]};
var TYPE_META = {
  Emergency:{icon:'🚨'},Food:{icon:'🍎'},Housing:{icon:'🏠'},Veteran:{icon:'🎖️'},
  Community:{icon:'🤝'},Assistance:{icon:'💼'},Transportation:{icon:'🚌'},
  Legal:{icon:'⚖️'},Health:{icon:'🏥'},Charity:{icon:'❤️'}
};

var PAGE_SIZE = 20; // pagination page size (confirmed)
var STATE = {
  resources: {offset: 0},
  hotlines: {offset: 0},
  nursing: {offset: 0},
  care: {offset: 0}
};

/* Utility: action buttons and sharing/printing helpers */
function actionButtonsHTML(item, idx){
  // buttons: Share, Text, Print, Copy Link
  var share = '<button type="button" class="usa-button--outline action-small" onclick="shareResource('+idx+')" aria-label="Share resource">🔗 Share</button>';
  var txt = '<button type="button" class="usa-button--outline action-small" onclick="textResource('+idx+')" aria-label="Text resource">✉️ Text</button>';
  var pr = '<button type="button" class="usa-button action-small" onclick="printResource('+idx+')" aria-label="Print resource">🖨️ Print</button>';
  var copy = '<button type="button" class="usa-button--outline action-small" onclick="copyResourceLink('+idx+')" aria-label="Copy resource link">📋 Copy</button>';
  return share + txt + pr + copy;
}

function resourceUrlFor(item){
  // Prefer a link to current page with query params; fallback to location.href
  try{
    var url = new URL(window.location.href);
    if(item && item.name){
      url.hash = 'resource-'+encodeURIComponent(item.name);
    }
    return url.toString();
  }catch(e){ return window.location.href; }
}

function shareResource(idx){
  var item = DATA.resources[idx] || {};
  var url = resourceUrlFor(item);
  var title = item.name || 'Resource';
  var text = (item.name?item.name+" - ":'') + (item.address?item.address+' ':'') + (item.phone?item.phone:'');
  if(navigator.share){
    navigator.share({title:title,text:text,url:url}).catch(function(){});
  } else {
    // fallback: open mailto
    var body = encodeURIComponent(text + '\n' + url);
    window.location.href = 'mailto:?subject='+encodeURIComponent(title)+'&body='+body;
  }
}

function copyResourceLink(idx){
  var item = DATA.resources[idx] || {};
  var url = resourceUrlFor(item);
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(function(){alert('Link copied to clipboard');});
  } else {
    prompt('Copy this link', url);
  }
}

function textResource(idx){
  var item = DATA.resources[idx] || {};
  var body = encodeURIComponent((item.name?item.name+' - ':'') + (item.address?item.address+' ':'') + (item.phone?item.phone+' ':'') + resourceUrlFor(item));
  if(item.phone){
    // use sms: scheme where supported
    window.location.href = 'sms:'+encodeURIComponent(item.phone)+'?body='+body;
  } else {
    if(navigator.clipboard){
      navigator.clipboard.writeText(decodeURIComponent(body)).then(function(){alert('Text content copied to clipboard for pasting into a messaging app');});
    } else {
      prompt('Text content', decodeURIComponent(body));
    }
  }
}

function printResource(idx){
  var item = DATA.resources[idx] || {};
  var w = window.open('','_blank');
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Print: '+(item.name?escapeHtml(item.name):'Resource')+'</title>'+
    '<style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#000} h1{font-size:20px} p{font-size:14px}</style></head><body>';
  html += '<h1>'+(item.name?escapeHtml(item.name):'')+'</h1>';
  if(item.address) html += '<p>Address: '+escapeHtml(item.address)+'</p>';
  if(item.city || item.county || item.state) html += '<p>Location: '+escapeHtml([item.city,item.county,item.state].filter(Boolean).join(', '))+'</p>';
  if(item.phone) html += '<p>Phone: '+escapeHtml(item.phone)+'</p>';
  if(item.notes) html += '<p>Notes: '+escapeHtml(item.notes)+'</p>';
  html += '<p>Source: '+escapeHtml(resourceUrlFor(item))+'</p>';
  html += '</body></html>';
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 500);
}


// ═══ Init ═══
document.addEventListener('DOMContentLoaded',function(){
  buildCountySelects();
  renderResources();
  renderHotlines();
  renderCounties();
  renderNursingHomes();
  renderCareHomes();
});

// ═══ Navigation ═══
function showTab(id,el){
  document.querySelectorAll('.jjp-section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.jjp-nav .usa-nav__link').forEach(function(l){l.classList.remove('usa-current');});
  document.getElementById('tab-'+id).classList.add('active');
  if(el) el.classList.add('usa-current');
  if(id==='map') initMap();
}

// ═══ County selects ═══
function buildCountySelects(){
  var counties=[];
  DATA.resources.forEach(function(r){if(r.county&&counties.indexOf(r.county)===-1)counties.push(r.county);});
  counties.sort();
  var opts='<option value="">All Counties</option>'+counties.map(function(c){return '<option>'+escapeHtml(c)+'</option>';}).join('');
  document.getElementById('res-county').innerHTML=opts;
  // Nursing home counties
  var nhc=[];
  DATA.nursing_homes.forEach(function(n){if(n.county&&nhc.indexOf(n.county)===-1)nhc.push(n.county);});
  nhc.sort();
  document.getElementById('nh-county').innerHTML='<option value="">All Counties</option>'+nhc.map(function(c){return '<option>'+escapeHtml(c)+'</option>';}).join('');
}

function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

// Announce messages to assistive tech. Uses a polite live region.
function announce(msg){
  var el = document.getElementById('aria-announcer');
  if(!el) return;
  // Clear then set to ensure repeated messages are read
  el.textContent = '';
  setTimeout(function(){ el.textContent = msg; }, 100);
}

// ═══ Resources ═══
function renderResources(loadMore){
  if(!loadMore) STATE.resources.offset = 0; // reset on new search/filter
  var q=(document.getElementById('res-search').value||'').toLowerCase();
  var type=document.getElementById('res-type').value;
  var county=document.getElementById('res-county').value;
  var items=DATA.resources.filter(function(r){
    if(type&&r.type!==type) return false;
    if(county&&r.county!==county) return false;
    if(q){
      var s=(r.name+' '+r.city+' '+r.county+' '+r.type+' '+(r.notes||'')).toLowerCase();
      if(s.indexOf(q)===-1) return false;
    }
    return true;
  });
  var total = items.length;
  var offset = STATE.resources.offset || 0;
  var end = Math.min(offset + PAGE_SIZE, total);
  var pageItems = items.slice(0, end);

  var html = '<p class="usa-hint">'+total+' resource(s) found</p>';
  if(!total){ document.getElementById('res-list').innerHTML = html; announce('No resources found'); return; }

  var cards = pageItems.map(function(r){
    var meta = TYPE_META[r.type]||{};
    var idx = DATA.resources.indexOf(r);
    return '<div class="jjp-card" tabindex="0">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
        '<div><strong>'+(meta.icon||'')+' '+escapeHtml(r.name)+'</strong>'+
        '<span class="type-badge type-'+(r.type?escapeHtml(r.type):'')+'" style="margin-left:8px">'+(r.type?escapeHtml(r.type):'')+'</span></div>'+
      '</div>'+
      '<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml([r.city,r.county,r.state].filter(Boolean).join(', '))+'</div>'+
      (r.address?('<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">📍 '+escapeHtml(r.address)+'</div>'):'')+
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+
        (r.phone?('<a href="tel:'+escapeHtml(r.phone)+'" class="usa-button usa-button--outline" aria-label="Call '+escapeHtml(r.name)+'">📞 '+escapeHtml(r.phone)+'</a>'):'')+
        (r.address?('<a href="https://www.google.com/maps/search/'+encodeURIComponent(r.address)+'" target="_blank" rel="noopener noreferrer" class="usa-button usa-button--outline" aria-label="Open map for '+escapeHtml(r.name)+'">🗺️ Map</a>'):'')+
        actionButtonsHTML(r, idx)+
      '</div>'+
      (r.notes?('<div style="font-size:.87rem;color:var(--cn-muted);margin-top:8px;font-style:italic">'+escapeHtml(r.notes)+'</div>'):'')+
    '</div>';
  }).join('');

  html += '<div class="jjp-list">'+cards+'</div>';

  if(total > end){
    html += '<div style="margin-top:12px;text-align:center">'+
      '<button class="usa-button" onclick="renderResources(true)" aria-controls="res-list" aria-label="Load more resources">Load More</button>'+
    '</div>';
    STATE.resources.offset = end; // next page will start from end
  } else {
    STATE.resources.offset = end;
  }

  document.getElementById('res-list').innerHTML = html; announce(total + ' resources found');
}

// ═══ Hotlines ═══
function renderHotlines(loadMore){
  if(!loadMore) STATE.hotlines.offset = 0;
  var q=(document.getElementById('hot-search').value||'').toLowerCase();
  var cat=document.getElementById('hot-category').value;
  var items=DATA.hotlines.filter(function(h){
    if(cat&&h.category!==cat) return false;
    if(q&&(h.name+' '+h.phone+' '+(h.notes||'')).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var total = items.length;
  var offset = STATE.hotlines.offset || 0;
  var end = Math.min(offset + PAGE_SIZE, total);
  var pageItems = items.slice(0, end);

  var html = '<p class="usa-hint">'+total+' hotline(s)</p>';
  if(!total){ document.getElementById('hot-list').innerHTML = html; announce('No hotlines found'); return; }

  var cards = pageItems.map(function(h){
    var idx = DATA.hotlines.indexOf(h);
    return '<div class="jjp-card" tabindex="0">'+
      '<div><strong>📞 '+escapeHtml(h.name)+'</strong>'+
      (h.category?('<span class="type-badge" style="margin-left:8px;background:#e0e7ff;color:#3730a3">'+escapeHtml(h.category)+'</span>'):'')+'</div>'+
      (h.notes?('<div style="font-size:.9rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml(h.notes)+'</div>'):'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (h.phone?('<a href="tel:'+escapeHtml(h.phone)+'" class="usa-button" aria-label="Call '+escapeHtml(h.name)+'">📞 '+escapeHtml(h.phone)+'</a>'):'')+
        actionButtonsHTML(h, idx)+
      '</div>'+
    '</div>';
  }).join('');

  html += '<div class="jjp-list">'+cards+'</div>';
  if(total > end){
    html += '<div style="margin-top:12px;text-align:center">'+
      '<button class="usa-button" onclick="renderHotlines(true)" aria-controls="hot-list" aria-label="Load more hotlines">Load More</button>'+
    '</div>';
    STATE.hotlines.offset = end;
  } else {
    STATE.hotlines.offset = end;
  }
  document.getElementById('hot-list').innerHTML = html; announce(total + ' hotlines found');
}

// ═══ Nursing Homes ═══
function renderNursingHomes(loadMore){
  if(!loadMore) STATE.nursing.offset = 0;
  var q=(document.getElementById('nh-search').value||'').toLowerCase();
  var state=document.getElementById('nh-state').value;
  var county=document.getElementById('nh-county').value;
  var items=DATA.nursing_homes.filter(function(n){
    if(state&&n.state!==state) return false;
    if(county&&n.county!==county) return false;
    if(q&&(n.name+' '+n.city+' '+n.county+' '+(n.notes||'')).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var total = items.length;
  var offset = STATE.nursing.offset || 0;
  var end = Math.min(offset + PAGE_SIZE, total);
  var pageItems = items.slice(0, end);

  var html = '<p class="usa-hint">'+total+' nursing home(s)</p>';
  if(!total){ document.getElementById('nh-list').innerHTML = html; announce('No nursing homes found'); return; }

  var cards = pageItems.map(function(n){
    var idx = DATA.nursing_homes.indexOf(n);
    return '<div class="jjp-card" tabindex="0">'+
      '<strong>🏥 '+escapeHtml(n.name)+'</strong>'+
      '<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml([n.city,n.county,n.state].filter(Boolean).join(', '))+'</div>'+
      (n.address?('<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">📍 '+escapeHtml(n.address)+'</div>'):'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (n.phone?('<a href="tel:'+escapeHtml(n.phone)+'" class="usa-button usa-button--outline" aria-label="Call '+escapeHtml(n.name)+'">📞 '+escapeHtml(n.phone)+'</a>'):'')+
        (n.fax?('<span style="font-size:.9rem;color:var(--cn-muted)">📠 '+escapeHtml(n.fax)+'</span>'):'')+
        (n.va_contract?('<span class="type-badge" style="background:#dcfce7;color:#166534">VA Contract</span>'):'')+
        (n.behavioral_unit?('<span class="type-badge" style="background:#ede9fe;color:#5b21b6">Behavioral Unit</span>'):'')+
        actionButtonsHTML(n, idx)+
      '</div>'+
    '</div>';
  }).join('');

  html += '<div class="jjp-list">'+cards+'</div>';
  if(total > end){
    html += '<div style="margin-top:12px;text-align:center">'+
      '<button class="usa-button" onclick="renderNursingHomes(true)" aria-controls="nh-list" aria-label="Load more nursing homes">Load More</button>'+
    '</div>';
    STATE.nursing.offset = end;
  } else {
    STATE.nursing.offset = end;
  }
  document.getElementById('nh-list').innerHTML = html; announce(total + ' nursing homes found');
}

// ═══ Care Homes ═══
function renderCareHomes(loadMore){
  if(!loadMore) STATE.care.offset = 0;
  var q=(document.getElementById('ch-search').value||'').toLowerCase();
  var state=document.getElementById('ch-state').value;
  var type=document.getElementById('ch-type').value;
  var items=DATA.care_homes.filter(function(c){
    if(state&&c.state!==state) return false;
    if(type&&c.facility_type!==type) return false;
    if(q&&(c.name+' '+c.city+' '+c.county).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var total = items.length;
  var offset = STATE.care.offset || 0;
  var end = Math.min(offset + PAGE_SIZE, total);
  var pageItems = items.slice(0, end);

  var typeLabels={RCF:'Residential Care',ALF:'Assisted Living',ICF:'Intermediate Care'};
  var html = '<p class="usa-hint">'+total+' care home(s)</p>';
  if(!total){ document.getElementById('ch-list').innerHTML = html; announce('No care homes found'); return; }

  var cards = pageItems.map(function(c){
    var idx = DATA.care_homes.indexOf(c);
    return '<div class="jjp-card" tabindex="0">'+
      '<strong>🏠 '+escapeHtml(c.name)+'</strong>'+
      '<span class="type-badge" style="margin-left:8px;background:#fef3c7;color:#92400e">'+escapeHtml((typeLabels[c.facility_type]||c.facility_type))+'</span>'+
      '<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml([c.city,c.county,c.state].filter(Boolean).join(', '))+'</div>'+
      (c.address?('<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">📍 '+escapeHtml(c.address)+'</div>'):'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (c.phone?('<a href="tel:'+escapeHtml(c.phone)+'" class="usa-button usa-button--outline" aria-label="Call '+escapeHtml(c.name)+'">📞 '+escapeHtml(c.phone)+'</a>'):'')+
        actionButtonsHTML(c, idx)+
      '</div>'+
    '</div>';
  }).join('');

  html += '<div class="jjp-list">'+cards+'</div>';
  if(total > end){
    html += '<div style="margin-top:12px;text-align:center">'+
      '<button class="usa-button" onclick="renderCareHomes(true)" aria-controls="ch-list" aria-label="Load more care homes">Load More</button>'+
    '</div>';
    STATE.care.offset = end;
  } else {
    STATE.care.offset = end;
  }
  document.getElementById('ch-list').innerHTML = html; announce(total + ' care homes found');
}

// ═══ Map ═══
var mapInitialized=false;
function loadScript(url, cb){
  var s = document.createElement('script'); s.src = url; s.async = true;
  s.onload = cb; s.onerror = cb; document.head.appendChild(s);
}
function loadCss(url){
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l);
}

function initMap(){
  if(mapInitialized) return;
  mapInitialized=true;
  // Load Leaflet assets on demand to avoid blocking initial render
  if(typeof L === 'undefined'){
    loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', function(){
      try{ _initLeaflet(); } catch(e){ console.error('Leaflet init failed',e); }
    });
  } else {
    _initLeaflet();
  }
}

function _initLeaflet(){
  var map=L.map('map').setView([36.7,-92.5],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  // Add nursing homes to map
  DATA.nursing_homes.forEach(function(n){
    if(n.lat&&n.lng){
      L.marker([n.lat,n.lng]).addTo(map).bindPopup('<strong>'+escapeHtml(n.name)+'</strong><br>'+escapeHtml(n.address||'')+'<br><a href="tel:'+escapeHtml(n.phone||'')+'">'+escapeHtml(n.phone||'')+'</a>');
    }
  });
  // Add care homes
  DATA.care_homes.forEach(function(c){
    if(c.lat&&c.lng){
      L.marker([c.lat,c.lng],{icon:L.divIcon({className:'ch-marker',html:'🏠',iconSize:[20,20]})}).addTo(map).bindPopup('<strong>'+escapeHtml(c.name)+'</strong><br>'+escapeHtml(c.address||'')+'<br><a href="tel:'+escapeHtml(c.phone||'')+'">'+escapeHtml(c.phone||'')+'</a>');
    }
  });
}

// ═══ Counties ═══
function countyUrl(county){
  try{ var url=new URL(window.location.href); url.searchParams.set('county', county); return url.toString(); }catch(e){ return window.location.href; }
}

function getCountyResources(county){
  return DATA.resources.filter(function(r){ return r.county===county; });
}

function shareCounty(county){
  var items = getCountyResources(county);
  var title = 'Resources in '+county;
  var text = items.slice(0,50).map(function(i){ return (i.name || '') + (i.phone?(' — '+i.phone):''); }).join('\n');
  var url = countyUrl(county);
  if(navigator.share){ navigator.share({title:title,text:text,url:url}).catch(function(){}); }
  else { var body = encodeURIComponent(text + '\n' + url); window.location.href = 'mailto:?subject='+encodeURIComponent(title)+'&body='+body; }
}

function copyCountyLink(county){
  var url = countyUrl(county);
  if(navigator.clipboard){ navigator.clipboard.writeText(url).then(function(){alert('County link copied to clipboard');}); }
  else { prompt('Copy this link', url); }
}

function textCounty(county){
  var items = getCountyResources(county);
  var text = items.slice(0,50).map(function(i){ return (i.name || '') + (i.phone?(' — '+i.phone):''); }).join('\n');
  var body = encodeURIComponent('Resources in '+county+'\n\n'+text+'\n\n'+countyUrl(county));
  // Open SMS composer without number; mobile will open messaging app
  window.location.href = 'sms:?body='+body;
}

function printCounty(county){
  // Print resources + nursing homes + care homes for the county
  var resources = getCountyResources(county);
  var nHomes = DATA.nursing_homes.filter(function(n){ return n.county === county; });
  var cHomes = DATA.care_homes.filter(function(c){ return c.county === county; });

  var w = window.open('','_blank');
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Print: '+escapeHtml(county)+'</title>'+
    '<style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#000} h1{font-size:22px;margin-bottom:6px} h2{font-size:18px;margin-top:18px} table{width:100%;border-collapse:collapse;margin-top:8px} td,th{padding:8px;border:1px solid #ccc;text-align:left} .meta{font-size:13px;color:#333;margin-top:10px}</style></head><body>';
  html += '<h1>Directory for '+escapeHtml(county)+'</h1>';
  html += '<p class="meta">This printout contains resources, nursing homes, and care homes for '+escapeHtml(county)+'.</p>';

  if(resources.length){
    html += '<h2>Resources ('+resources.length+')</h2>';
    html += '<table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Notes</th></tr></thead><tbody>';
    resources.forEach(function(i){ html += '<tr><td>'+escapeHtml(i.name||'')+'</td><td>'+escapeHtml(i.phone||'')+'</td><td>'+escapeHtml(i.address||'')+'</td><td>'+escapeHtml(i.notes||'')+'</td></tr>'; });
    html += '</tbody></table>';
  }

  if(nHomes.length){
    html += '<h2>Nursing Homes ('+nHomes.length+')</h2>';
    html += '<table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Notes</th></tr></thead><tbody>';
    nHomes.forEach(function(n){ html += '<tr><td>'+escapeHtml(n.name||'')+'</td><td>'+escapeHtml(n.phone||'')+'</td><td>'+escapeHtml(n.address||'')+'</td><td>'+(n.va_contract? 'VA Contract' : '')+'</td></tr>'; });
    html += '</tbody></table>';
  }

  if(cHomes.length){
    html += '<h2>Care Homes ('+cHomes.length+')</h2>';
    html += '<table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Type</th></tr></thead><tbody>';
    cHomes.forEach(function(c){ html += '<tr><td>'+escapeHtml(c.name||'')+'</td><td>'+escapeHtml(c.phone||'')+'</td><td>'+escapeHtml(c.address||'')+'</td><td>'+escapeHtml(c.facility_type||'')+'</td></tr>'; });
    html += '</tbody></table>';
  }

  html += '<p class="meta">Source: '+escapeHtml(countyUrl(county))+'</p>';
  html += '</body></html>';
  w.document.write(html); w.document.close(); w.focus(); setTimeout(function(){ w.print(); }, 500);
}

// Toolbar helper: populate top select and provide toolbar actions
function buildCountyToolbar(){
  var counties={};
  DATA.resources.forEach(function(r){ if(r.county){counties[r.county]=(counties[r.county]||0)+1;} });
  var sorted=Object.keys(counties).sort();
  var sel = document.getElementById('county-top-select');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Choose a county --</option>' + sorted.map(function(c){ return '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>'; }).join('');
  // enable/disable toolbar based on selection
  onCountyToolbarChange();
  announce('County toolbar updated');
}

function onCountyToolbarChange(){
  var sel = document.getElementById('county-top-select');
  var val = sel && sel.value ? sel.value : '';
  var ids = ['county-share-btn','county-text-btn','county-print-btn','county-copy-btn'];
  ids.forEach(function(id){ var b = document.getElementById(id); if(b) b.disabled = !val; });
}

function shareCountyFromToolbar(){ var sel=document.getElementById('county-top-select'); if(sel && sel.value) shareCounty(sel.value); }
function copyCountyLinkFromToolbar(){ var sel=document.getElementById('county-top-select'); if(sel && sel.value) copyCountyLink(sel.value); }
function textCountyFromToolbar(){ var sel=document.getElementById('county-top-select'); if(sel && sel.value) textCounty(sel.value); }
function printCountyFromToolbar(){ var sel=document.getElementById('county-top-select'); if(sel && sel.value) printCounty(sel.value); }

function renderCounties(){
  var counties={};
  DATA.resources.forEach(function(r){
    if(r.county){counties[r.county]=(counties[r.county]||0)+1;}
  });
  var sorted=Object.keys(counties).sort();
  var html='<p class="usa-hint">Click a county to see resources</p>';
  html+=sorted.map(function(c){
    var count=counties[c];
    var nhCount=DATA.nursing_homes.filter(function(n){return n.county===c;}).length;
    var chCount=DATA.care_homes.filter(function(ch){return ch.county===c;}).length;
    var safe = c.replace(/'/g,"\\'");
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin:6px">'+
      '<button type="button" class="county-chip" onclick="filterByCounty(\''+safe+'\')">'+escapeHtml(c)+' <span style="font-weight:400;opacity:.7">('+count+' resources'+(nhCount?' • '+nhCount+' NH':'')+(chCount?' • '+chCount+' CH':'')+')</span></button>'+
      '<div style="display:flex;gap:6px;margin-left:8px">'+
        '<button class="usa-button--outline action-small" onclick="shareCounty(\''+safe+'\')" aria-label="Share '+escapeHtml(c)+'">🔗</button>'+
        '<button class="usa-button--outline action-small" onclick="textCounty(\''+safe+'\')" aria-label="Text '+escapeHtml(c)+'">✉️</button>'+
        '<button class="usa-button action-small" onclick="printCounty(\''+safe+'\')" aria-label="Print '+escapeHtml(c)+'">🖨️</button>'+
        '<button class="usa-button--outline action-small" onclick="copyCountyLink(\''+safe+'\')" aria-label="Copy link '+escapeHtml(c)+'">📋</button>'+
      '</div></div>';
  }).join('');
  document.getElementById('county-list').innerHTML=html; announce(sorted.length + ' counties available');
  // refresh top toolbar select
  buildCountyToolbar();
}

function filterByCounty(county){
  document.getElementById('res-county').value=county;
  showTab('resources',document.querySelector('.jjp-nav .usa-nav__link'));
  renderResources();
  window.scrollTo(0,0);
}
