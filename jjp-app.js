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
  if(!total){ document.getElementById('res-list').innerHTML = html; return; }

  var cards = pageItems.map(function(r){
    var meta = TYPE_META[r.type]||{};
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

  document.getElementById('res-list').innerHTML = html;
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
  if(!total){ document.getElementById('hot-list').innerHTML = html; return; }

  var cards = pageItems.map(function(h){
    return '<div class="jjp-card" tabindex="0">'+
      '<div><strong>📞 '+escapeHtml(h.name)+'</strong>'+
      (h.category?('<span class="type-badge" style="margin-left:8px;background:#e0e7ff;color:#3730a3">'+escapeHtml(h.category)+'</span>'):'')+'</div>'+
      (h.notes?('<div style="font-size:.9rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml(h.notes)+'</div>'):'')+
      '<div style="margin-top:8px"><a href="tel:'+escapeHtml(h.phone)+'" class="usa-button" aria-label="Call '+escapeHtml(h.name)+'">📞 '+escapeHtml(h.phone)+'</a></div>'+
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
  document.getElementById('hot-list').innerHTML = html;
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
  if(!total){ document.getElementById('nh-list').innerHTML = html; return; }

  var cards = pageItems.map(function(n){
    return '<div class="jjp-card" tabindex="0">'+
      '<strong>🏥 '+escapeHtml(n.name)+'</strong>'+
      '<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml([n.city,n.county,n.state].filter(Boolean).join(', '))+'</div>'+
      (n.address?('<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">📍 '+escapeHtml(n.address)+'</div>'):'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (n.phone?('<a href="tel:'+escapeHtml(n.phone)+'" class="usa-button usa-button--outline" aria-label="Call '+escapeHtml(n.name)+'">📞 '+escapeHtml(n.phone)+'</a>'):'')+
        (n.fax?('<span style="font-size:.9rem;color:var(--cn-muted)">📠 '+escapeHtml(n.fax)+'</span>'):'')+
        (n.va_contract?('<span class="type-badge" style="background:#dcfce7;color:#166534">VA Contract</span>'):'')+
        (n.behavioral_unit?('<span class="type-badge" style="background:#ede9fe;color:#5b21b6">Behavioral Unit</span>'):'')+
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
  document.getElementById('nh-list').innerHTML = html;
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
  if(!total){ document.getElementById('ch-list').innerHTML = html; return; }

  var cards = pageItems.map(function(c){
    return '<div class="jjp-card" tabindex="0">'+
      '<strong>🏠 '+escapeHtml(c.name)+'</strong>'+
      '<span class="type-badge" style="margin-left:8px;background:#fef3c7;color:#92400e">'+escapeHtml((typeLabels[c.facility_type]||c.facility_type))+'</span>'+
      '<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">'+escapeHtml([c.city,c.county,c.state].filter(Boolean).join(', '))+'</div>'+
      (c.address?('<div style="font-size:.92rem;color:var(--cn-muted);margin-top:6px">📍 '+escapeHtml(c.address)+'</div>'):'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (c.phone?('<a href="tel:'+escapeHtml(c.phone)+'" class="usa-button usa-button--outline" aria-label="Call '+escapeHtml(c.name)+'">📞 '+escapeHtml(c.phone)+'</a>'):'')+
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
  document.getElementById('ch-list').innerHTML = html;
}

// ═══ Map ═══
var mapInitialized=false;
function initMap(){
  if(mapInitialized) return;
  mapInitialized=true;
  var map=L.map('map').setView([36.7,-92.5],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  // Add nursing homes to map
  DATA.nursing_homes.forEach(function(n){
    if(n.lat&&n.lng){
      L.marker([n.lat,n.lng]).addTo(map).bindPopup('<strong>'+n.name+'</strong><br>'+n.address+'<br><a href="tel:'+n.phone+'">'+n.phone+'</a>');
    }
  });
  // Add care homes
  DATA.care_homes.forEach(function(c){
    if(c.lat&&c.lng){
      L.marker([c.lat,c.lng],{icon:L.divIcon({className:'ch-marker',html:'🏠',iconSize:[20,20]})}).addTo(map).bindPopup('<strong>'+c.name+'</strong><br>'+c.address+'<br><a href="tel:'+c.phone+'">'+c.phone+'</a>');
    }
  });
}

// ═══ Counties ═══
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
    return '<button type="button" class="county-chip" onclick="filterByCounty(\''+c.replace(/'/g,"\\'")+'\')">'+
      escapeHtml(c)+' <span style="font-weight:400;opacity:.7">('+count+' resources'+(nhCount?' • '+nhCount+' NH':'')+(chCount?' • '+chCount+' CH':'')+')</span></button>';
  }).join('');
  document.getElementById('county-list').innerHTML=html;
}

function filterByCounty(county){
  document.getElementById('res-county').value=county;
  showTab('resources',document.querySelector('.jjp-nav .usa-nav__link'));
  renderResources();
  window.scrollTo(0,0);
}
