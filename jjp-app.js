/* JJP Resource Directory — Static App Logic */

var DATA = JJP_DATA || {resources:[],hotlines:[],nursing_homes:[],care_homes:[]};
var TYPE_META = {
  Emergency:{icon:'🚨'},Food:{icon:'🍎'},Housing:{icon:'🏠'},Veteran:{icon:'🎖️'},
  Community:{icon:'🤝'},Assistance:{icon:'💼'},Transportation:{icon:'🚌'},
  Legal:{icon:'⚖️'},Health:{icon:'🏥'},Charity:{icon:'❤️'}
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
  var opts='<option value="">All Counties</option>'+counties.map(function(c){return '<option>'+c+'</option>';}).join('');
  document.getElementById('res-county').innerHTML=opts;
  // Nursing home counties
  var nhc=[];
  DATA.nursing_homes.forEach(function(n){if(n.county&&nhc.indexOf(n.county)===-1)nhc.push(n.county);});
  nhc.sort();
  document.getElementById('nh-county').innerHTML='<option value="">All Counties</option>'+nhc.map(function(c){return '<option>'+c+'</option>';}).join('');
}

// ═══ Resources ═══
function renderResources(){
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
  var html='<p class="usa-hint">'+items.length+' resource(s) found</p>';
  if(!items.length){document.getElementById('res-list').innerHTML=html;return;}
  html+=items.slice(0,200).map(function(r){
    var meta=TYPE_META[r.type]||{};
    return '<div class="jjp-card">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
        '<div><strong>'+(meta.icon||'')+' '+r.name+'</strong>'+
        '<span class="type-badge type-'+r.type+'" style="margin-left:8px">'+r.type+'</span></div>'+
      '</div>'+
      '<div style="font-size:.85rem;color:#5c6a7a;margin-top:4px">'+[r.city,r.county,r.state].filter(Boolean).join(', ')+'</div>'+
      (r.address?'<div style="font-size:.85rem;color:#5c6a7a">📍 '+r.address+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (r.phone?'<a href="tel:'+r.phone+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+r.phone+'</a>':'')+
        (r.address?'<a href="https://www.google.com/maps/search/'+encodeURIComponent(r.address)+'" target="_blank" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">🗺️ Map</a>':'')+
      '</div>'+
      (r.notes?'<div style="font-size:.8rem;color:#5c6a7a;margin-top:6px;font-style:italic">'+r.notes+'</div>':'')+
    '</div>';
  }).join('');
  if(items.length>200) html+='<p class="usa-hint">Showing first 200 of '+items.length+' results. Refine your search.</p>';
  document.getElementById('res-list').innerHTML=html;
  setTimeout(function(){
    var cards=document.querySelectorAll('#res-list .jjp-card');
    for(var i=0;i<cards.length;i++){
      var it=items[i]||{};
      var id=it.id||('r'+i);
      cards[i].id='res-'+id;
      var menu=document.createElement('div');
      menu.className='card-menu';
      menu.innerHTML='<button class="card-menu-btn" onclick="toggleCardMenu(event)">⋮</button><div class="card-menu-dropdown"><button onclick="printResource('res-'+id+'')">Print</button><button onclick="copyResource('res-'+id+'')">Copy Text</button><button onclick="shareResource('res-'+id+'')">Share</button></div>';
      var hdr=cards[i].firstElementChild;
      if(hdr)hdr.appendChild(menu);
    }
  },10);
}

function toggleCardMenu(event){
  event.stopPropagation();
  var dd=event.currentTarget.nextElementSibling;
  var was=dd.style.display==='block';
  document.querySelectorAll('.card-menu-dropdown').forEach(function(d){d.style.display='none';});
  dd.style.display=was?'none':'block';
}
function printResource(id){
  var el=document.getElementById(id);
  if(!el)return;
  var w=window.open('','_blank');
  w.document.write('<html><head><title>JJP Resource</title><style>body{font-family:Arial,sans-serif;padding:20px} .card-menu,.card-menu-btn,.card-menu-dropdown{display:none!important}</style></head><body>'+el.outerHTML+'</body></html>');
  w.document.close();
  setTimeout(function(){w.print()},300);
}
function copyResource(id){
  var el=document.getElementById(id);
  if(!el)return;
  var txt=el.innerText.trim();
  navigator.clipboard.writeText(txt).then(function(){alert('Copied!')}).catch(function(){prompt('Copy:',txt)});
}
function shareResource(id){
  var el=document.getElementById(id);
  if(!el)return;
  var txt=el.innerText.trim();
  if(navigator.share){navigator.share({title:'JJP Resource',text:txt}).catch(function(){});}
  else{window.open('mailto:?subject=JJP Resource&body='+encodeURIComponent(txt));}
}
document.addEventListener('click',function(){
  document.querySelectorAll('.card-menu-dropdown').forEach(function(d){d.style.display='none';});
});


// ═══ Hotlines ═══
function renderHotlines(){
  var q=(document.getElementById('hot-search').value||'').toLowerCase();
  var cat=document.getElementById('hot-category').value;
  var items=DATA.hotlines.filter(function(h){
    if(cat&&h.category!==cat) return false;
    if(q&&(h.name+' '+h.phone+' '+(h.notes||'')).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var html='<p class="usa-hint">'+items.length+' hotline(s)</p>';
  html+=items.map(function(h){
    return '<div class="jjp-card">'+
      '<strong>📞 '+h.name+'</strong>'+
      '<span class="type-badge" style="margin-left:8px;background:#e0e7ff;color:#3730a3">'+h.category+'</span>'+
      '<div style="margin-top:6px"><a href="tel:'+h.phone+'" class="usa-button" style="font-size:.85rem">📞 '+h.phone+'</a></div>'+
      (h.notes?'<div style="font-size:.8rem;color:#5c6a7a;margin-top:4px">'+h.notes+'</div>':'')+
    '</div>';
  }).join('');
  document.getElementById('hot-list').innerHTML=html;
}

// ═══ Nursing Homes ═══
function renderNursingHomes(){
  var q=(document.getElementById('nh-search').value||'').toLowerCase();
  var state=document.getElementById('nh-state').value;
  var county=document.getElementById('nh-county').value;
  var items=DATA.nursing_homes.filter(function(n){
    if(state&&n.state!==state) return false;
    if(county&&n.county!==county) return false;
    if(q&&(n.name+' '+n.city+' '+n.county+' '+(n.notes||'')).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var html='<p class="usa-hint">'+items.length+' nursing home(s)</p>';
  html+=items.map(function(n){
    return '<div class="jjp-card">'+
      '<strong>🏥 '+n.name+'</strong>'+
      '<div style="font-size:.85rem;color:#5c6a7a;margin-top:4px">'+[n.city,n.county,n.state].filter(Boolean).join(', ')+'</div>'+
      (n.address?'<div style="font-size:.85rem;color:#5c6a7a">📍 '+n.address+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (n.phone?'<a href="tel:'+n.phone+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+n.phone+'</a>':'')+
        (n.fax?'<span style="font-size:.75rem;color:#5c6a7a">📠 '+n.fax+'</span>':'')+
        (n.va_contract?'<span class="type-badge" style="background:#dcfce7;color:#166534">VA Contract</span>':'')+
        (n.behavioral_unit?'<span class="type-badge" style="background:#ede9fe;color:#5b21b6">Behavioral Unit</span>':'')+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('nh-list').innerHTML=html;
}

// ═══ Care Homes ═══
function renderCareHomes(){
  var q=(document.getElementById('ch-search').value||'').toLowerCase();
  var state=document.getElementById('ch-state').value;
  var type=document.getElementById('ch-type').value;
  var items=DATA.care_homes.filter(function(c){
    if(state&&c.state!==state) return false;
    if(type&&c.facility_type!==type) return false;
    if(q&&(c.name+' '+c.city+' '+c.county).toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
  var typeLabels={RCF:'Residential Care',ALF:'Assisted Living',ICF:'Intermediate Care'};
  var html='<p class="usa-hint">'+items.length+' care home(s)</p>';
  html+=items.map(function(c){
    return '<div class="jjp-card">'+
      '<strong>🏠 '+c.name+'</strong>'+
      '<span class="type-badge" style="margin-left:8px;background:#fef3c7;color:#92400e">'+(typeLabels[c.facility_type]||c.facility_type)+'</span>'+
      '<div style="font-size:.85rem;color:#5c6a7a;margin-top:4px">'+[c.city,c.county,c.state].filter(Boolean).join(', ')+'</div>'+
      (c.address?'<div style="font-size:.85rem;color:#5c6a7a">📍 '+c.address+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (c.phone?'<a href="tel:'+c.phone+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+c.phone+'</a>':'')+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('ch-list').innerHTML=html;
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
    return '<span class="county-chip" onclick="filterByCounty(\''+c.replace(/'/g,"\\'")+'\')">'+
      c+' <span style="font-weight:400;opacity:.7">('+count+' resources'+(nhCount?' • '+nhCount+' NH':'')+(chCount?' • '+chCount+' CH':'')+')</span></span>';
  }).join('');
  document.getElementById('county-list').innerHTML=html;
}

function filterByCounty(county){
  document.getElementById('res-county').value=county;
  showTab('resources',document.querySelector('.jjp-nav .usa-nav__link'));
  renderResources();
  window.scrollTo(0,0);
}
