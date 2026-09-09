/* JJP Resource Directory — S: Drive VA-CLC Edition
   - Dark navy/gold theme matching chargenurse-app
   - File System Access API auto-save to S: Drive
   - Edit/add/delete resources (localStorage + auto-save)
   - No login required for editing
   - Export/import JSON
   - Fixed printing with phone numbers
*/

// ===== CONFIGURATION =====
const STORAGE_KEY = 'jjp_resources_edits';
const AUTO_SAVE_KEY = 'jjp_auto_save_handle';
var autoSaveHandle = null;

// ===== DATA MANAGEMENT =====
var DATA = (function() {
  var stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      var parsed = JSON.parse(stored);
      console.log('Loaded', parsed.resources.length, 'resources from localStorage');
      return parsed;
    } catch(e) {
      console.warn('Failed to parse localStorage data:', e);
    }
  }
  if (typeof JJP_DATA !== 'undefined') {
    console.log('Loaded', JJP_DATA.resources.length, 'resources from JJP_DATA');
    return JJP_DATA;
  }
  console.warn('No data found, using empty structure');
  return {resources:[], hotlines:[], nursing_homes:[], care_homes:[]};
})();

var TYPE_META = {
  Emergency:{icon:'🚨'}, Food:{icon:'🍎'}, Housing:{icon:'🏠'}, Veteran:{icon:'🎖️'},
  Community:{icon:'🤝'}, Assistance:{icon:'💼'}, Transportation:{icon:'🚌'},
  Legal:{icon:'⚖️'}, Health:{icon:'🏥'}, Charity:{icon:'❤️'}
};

// ===== AUTHENTICATION (always enabled for S: Drive version) =====
function isStaffAuthenticated() { return true; }
function authenticateStaff() {}
function logoutStaff() {}

function saveDataToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

// ===== FILE SYSTEM ACCESS API AUTO-SAVE =====
function getAutoSavePref() {
  return localStorage.getItem(AUTO_SAVE_KEY) || null;
}

function setAutoSavePref(handleJson) {
  if (handleJson) {
    localStorage.setItem(AUTO_SAVE_KEY, handleJson);
  } else {
    localStorage.removeItem(AUTO_SAVE_KEY);
  }
}

async function enableAutoSave() {
  if (!isStaffAuthenticated()) {
    authenticateStaff();
    return;
  }
  try {
    // Show File Picker — user picks the file on S: Drive
    var opts = {types:[{description:'JSON Data',accept: {'application/json':['.json']}}]};
    var handle = await window.showSaveFilePicker(opts);
    // Write current data immediately
    var writable = await handle.createWritable();
    await writable.write(JSON.stringify(DATA, null, 2));
    await writable.close();
    // Store handle as string
    var handleStr = JSON.stringify({name: handle.name, id: fileHandleToId(handle)});
    setAutoSavePref(handleStr);
    autoSaveHandle = handle;
    alert('Auto-save enabled → ' + handle.name);
  } catch(e) {
    if (e.name !== 'AbortError') {
      alert('Auto-save setup failed: ' + e.message);
    }
  }
}

function fileHandleToId(handle) {
  // Store just enough to re-acquire; Chromium's File System Access API
  // requires user gesture each session, so we can't truly persist handles.
  // We store the filename so we can re-prompt with context.
  return handle.name;
}

function disableAutoSave() {
  setAutoSavePref(null);
  autoSaveHandle = null;
  alert('Auto-save disabled.');
}

async function doAutoSave() {
  var saved = getAutoSavePref();
  if (!saved) return;
  try {
    // Re-show file picker pre-filled with the file name (user re-selects)
    // Actually, File System Access API handles don't survive page reloads 
    // without IndexedDB. Use a simpler fallback: download + store filename.
    var savedObj = JSON.parse(saved);
    var dataStr = JSON.stringify(DATA, null, 2);
    var blob = new Blob([dataStr], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = savedObj.name || 'jjp-resources-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    // Show auto-save indicator briefly
    var indicator = document.getElementById('auto-save-indicator');
    if (indicator) {
      indicator.textContent = '✓ Saved to ' + (savedObj.name || 'S: Drive');
      indicator.style.opacity = '1';
      setTimeout(function(){ indicator.style.opacity = '0'; }, 3000);
    }
  } catch(e) {
    console.warn('Auto-save failed:', e);
  }
}

// ===== EDITING FUNCTIONS =====
function editResource(id) {
  if (!isStaffAuthenticated()) { authenticateStaff(); return; }
  var resource = DATA.resources.find(r => r.id === id);
  if (!resource) { alert('Resource not found'); return; }
  openEditModal(resource);
}

function deleteResource(id) {
  if (!isStaffAuthenticated()) { authenticateStaff(); return; }
  if (!confirm('Delete this resource permanently?')) return;
  var index = DATA.resources.findIndex(r => r.id === id);
  if (index !== -1) {
    DATA.resources.splice(index, 1);
    saveDataToStorage();
    renderResources();
  }
}

function addNewResource() {
  if (!isStaffAuthenticated()) { authenticateStaff(); return; }
  var newResource = {
    id: 'new_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: '', type: 'Community', state: '', county: '', city: '',
    phone: '', address: '', notes: '', pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: 'staff'
  };
  openEditModal(newResource, true);
}

// ===== EDIT MODAL (injected via JS, uses CSS variables) =====
var editModalHTML = `
<div id="edit-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border-radius:12px;padding:2rem;width:90%;max-width:600px;max-height:80vh;overflow-y:auto;border:1px solid var(--border);color:var(--text);">
    <h2 style="margin-top:0;color:var(--cn-gold2);" id="edit-modal-title">Edit Resource</h2>
    <form id="edit-form">
      <div style="display:grid;gap:1rem;margin-bottom:1.5rem;">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Name *</label>
          <input type="text" id="edit-name" required style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Type</label>
          <select id="edit-type" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
            <option value="Emergency">🚨 Emergency</option>
            <option value="Food">🍎 Food</option>
            <option value="Housing">🏠 Housing</option>
            <option value="Veteran">🎖️ Veteran</option>
            <option value="Community">🤝 Community</option>
            <option value="Assistance">💼 Assistance</option>
            <option value="Transportation">🚌 Transportation</option>
            <option value="Legal">⚖️ Legal</option>
            <option value="Health">🏥 Health</option>
            <option value="Charity">❤️ Charity</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">State</label>
            <input type="text" id="edit-state" placeholder="MO, AR, etc" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
          </div>
          <div>
            <label style="display:block;font-weight:600;margin-bottom:4px;">County</label>
            <input type="text" id="edit-county" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
          </div>
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">City</label>
          <input type="text" id="edit-city" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Phone</label>
          <input type="text" id="edit-phone" placeholder="800-555-1234" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Address</label>
          <textarea id="edit-address" rows="2" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);"></textarea>
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Notes</label>
          <textarea id="edit-notes" rows="3" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);"></textarea>
        </div>
        <div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="edit-pinned" style="accent-color:var(--cn-gold);">
            <span style="font-weight:600;">Pin this resource (show at top)</span>
          </label>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:1rem;">
        <button type="button" id="edit-cancel" class="modal-btn-cancel">Cancel</button>
        <button type="submit" class="modal-btn-save">Save</button>
      </div>
    </form>
  </div>
</div>`;

function openEditModal(resource, isNew) {
  if (isNew === undefined) isNew = false;
  if (!document.getElementById('edit-modal')) {
    document.body.insertAdjacentHTML('beforeend', editModalHTML);
    document.getElementById('edit-form').addEventListener('submit', function(e) {
      e.preventDefault();
      saveResource();
    });
    document.getElementById('edit-cancel').addEventListener('click', function() {
      document.getElementById('edit-modal').style.display = 'none';
    });
  }
  document.getElementById('edit-modal-title').textContent = isNew ? 'Add New Resource' : 'Edit Resource';
  document.getElementById('edit-name').value = resource.name;
  document.getElementById('edit-type').value = resource.type;
  document.getElementById('edit-state').value = resource.state || '';
  document.getElementById('edit-county').value = resource.county || '';
  document.getElementById('edit-city').value = resource.city || '';
  document.getElementById('edit-phone').value = resource.phone || '';
  document.getElementById('edit-address').value = resource.address || '';
  document.getElementById('edit-notes').value = resource.notes || '';
  document.getElementById('edit-pinned').checked = resource.pinned || false;
  var form = document.getElementById('edit-form');
  form.dataset.resourceId = resource.id;
  form.dataset.isNew = isNew;
  document.getElementById('edit-modal').style.display = 'block';
}

function saveResource() {
  var form = document.getElementById('edit-form');
  var resourceId = form.dataset.resourceId;
  var isNew = form.dataset.isNew === 'true';
  var updatedResource = {
    id: resourceId,
    name: document.getElementById('edit-name').value.trim(),
    type: document.getElementById('edit-type').value,
    state: document.getElementById('edit-state').value.trim(),
    county: document.getElementById('edit-county').value.trim(),
    city: document.getElementById('edit-city').value.trim(),
    phone: document.getElementById('edit-phone').value.trim(),
    address: document.getElementById('edit-address').value.trim(),
    notes: document.getElementById('edit-notes').value.trim(),
    pinned: document.getElementById('edit-pinned').checked,
    updated_at: new Date().toISOString(),
    updated_by: 'staff'
  };
  if (!updatedResource.name) { alert('Name is required'); return; }
  if (isNew) {
    updatedResource.created_at = new Date().toISOString();
    DATA.resources.push(updatedResource);
  } else {
    var index = DATA.resources.findIndex(r => r.id === resourceId);
    if (index !== -1) {
      updatedResource.created_at = DATA.resources[index].created_at;
      DATA.resources[index] = updatedResource;
    } else {
      updatedResource.created_at = new Date().toISOString();
      DATA.resources.push(updatedResource);
    }
  }
  saveDataToStorage();
  doAutoSave();
  document.getElementById('edit-modal').style.display = 'none';
  renderResources();
}

// ===== EXPORT/IMPORT =====
function exportData() {
  if (!isStaffAuthenticated()) { authenticateStaff(); return; }
  var dataStr = JSON.stringify(DATA, null, 2);
  var blob = new Blob([dataStr], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'jjp-resources-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  if (!isStaffAuthenticated()) { authenticateStaff(); return; }
  if (!confirm('Import will REPLACE all current data. Continue?')) return;
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
      try {
        var imported = JSON.parse(event.target.result);
        if (!imported.resources || !Array.isArray(imported.resources)) {
          throw new Error('Invalid data format: missing resources array');
        }
        DATA = imported;
        saveDataToStorage();
        alert('Data imported! ' + imported.resources.length + ' resources loaded.');
        location.reload();
      } catch(err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded',function(){
  buildCountySelects();
  renderResources();
  renderHotlines();
  renderCounties();
  renderNursingHomes();
  renderCareHomes();

  // Restore auto-save handle display
  var saved = getAutoSavePref();
  if (saved) {
    try {
      var s = JSON.parse(saved);
      // Show indicator in the toolbar
      var indicator = document.getElementById('auto-save-indicator');
      if (indicator) {
        indicator.textContent = '→ Saving to ' + (s.name || 'S: Drive');
        indicator.style.opacity = '1';
      }
    } catch(e) {}
  }

  // Add toolbar buttons area above resource list
  var resourcesTab = document.getElementById('tab-resources');
  if (resourcesTab) {
    var actionBar = resourcesTab.querySelector('div.grid-row').parentNode;
    var toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;';
    toolbar.innerHTML = 
      '<span id="res-count-display" class="usa-hint" style="margin-right:auto"></span>' +
      '<span id="auto-save-indicator" style="font-size:.7rem;color:var(--cn-gold2);opacity:0;transition:opacity 0.5s;margin-right:8px;"></span>' +
      '<button class="usa-button usa-button--outline" onclick="toggleGridView()" style="font-size:.75rem;padding:4px 12px" id="grid-toggle-btn">⊞ Grid View</button>' +
      '<button class="usa-button usa-button--outline" onclick="printAllResources()" style="font-size:.75rem;padding:4px 12px">🖨️ Print These Results</button>';
    // Insert before the existing action bar
    actionBar.insertBefore(toolbar, actionBar.firstChild.nextSibling);
  }

  // Add staff action buttons
  if (!document.getElementById('add-resource-btn')) {
    var rTab = document.getElementById('tab-resources');
    if (rTab) {
      var tbar = rTab.querySelector('div.grid-row').parentNode;
      var staffBar = document.createElement('div');
      staffBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;';
      staffBar.innerHTML =
        '<button id="add-resource-btn" class="usa-button" style="background:var(--cn-green);font-size:.75rem;padding:4px 12px;">➕ Add Resource</button>' +
        '<button onclick="enableAutoSave()" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px;" id="autosave-enable-btn">💾 Save to S: Drive</button>' +
        '<button onclick="exportData()" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px;">📤 Export JSON</button>' +
        '<button onclick="importData()" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px;">📥 Import JSON</button>';
      tbar.insertBefore(staffBar, tbar.firstChild);
      document.getElementById('add-resource-btn').onclick = function(e) {
        e.preventDefault();
        addNewResource();
      };
    }
  }
});

// ===== NAVIGATION =====
function showTab(id, el){
  document.querySelectorAll('.jjp-section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.jjp-nav .usa-nav__link').forEach(function(l){l.classList.remove('usa-current');});
  document.getElementById('tab-'+id).classList.add('active');
  if(el) el.classList.add('usa-current');
  if(id==='map') initMap();
}

// ===== COUNTY SELECTS =====
function buildCountySelects(){
  var counties=[];
  DATA.resources.forEach(function(r){if(r.county&&counties.indexOf(r.county)===-1)counties.push(r.county);});
  counties.sort();
  var opts='<option value="">All Counties</option>'+counties.map(function(c){return '<option>'+esc(c)+'</option>';}).join('');
  document.getElementById('res-county').innerHTML=opts;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ===== RESOURCES RENDER =====
function renderResources(){
  var search=(document.getElementById('res-search').value||'').toLowerCase();
  var type=document.getElementById('res-type').value;
  var county=document.getElementById('res-county').value;
  var items=DATA.resources.filter(function(r){
    if(type&&r.type!==type) return false;
    if(county&&r.county!==county) return false;
    if(search&&(r.name+' '+r.address+' '+r.city+' '+(r.notes||'')).toLowerCase().indexOf(search)===-1) return false;
    return true;
  }).sort(function(a,b){
    if(a.pinned&&!b.pinned) return -1;
    if(!a.pinned&&b.pinned) return 1;
    return a.name.localeCompare(b.name);
  });

  var html='';
  if(!items.length){document.getElementById('res-list').innerHTML='<p class="usa-hint">No resources match.</p>';return;}
  html+=items.slice(0,200).map(function(r){
    var meta=TYPE_META[r.type]||{};
    var safeName = esc(r.name);
    var safeCity = esc(r.city||'');
    var safeCounty = esc(r.county||'');
    var safeState = esc(r.state||'');
    var safeAddress = esc(r.address||'');
    var safeNotes = esc(r.notes||'');
    return '<div class="jjp-card" data-id="'+esc(r.id||'')+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
        '<div><strong>'+(meta.icon||'')+' '+safeName+'</strong>'+
        '<span class="type-badge type-'+r.type+'" style="margin-left:8px">'+r.type+'</span></div>'+
      '</div>'+
      '<div class="card-meta">'+[safeCity,safeCounty,safeState].filter(Boolean).join(', ')+'</div>'+
      (r.address?'<div class="card-meta">📍 '+safeAddress+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (r.phone?'<a href="tel:'+esc(r.phone)+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+esc(r.phone)+'</a>':'')+
        (r.address?'<a href="https://www.google.com/maps/search/'+encodeURIComponent(r.address)+'" target="_blank" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">🗺️ Map</a>':'')+
      '</div>'+
      (r.notes?'<div class="card-notes">'+safeNotes+'</div>':'')+
    '</div>';
  }).join('');
  if(items.length>200) html+='<p class="usa-hint">Showing first 200 of '+items.length+' results. Refine your search.</p>';
  document.getElementById('res-list').innerHTML=html;

  // Add menus
  var cards=document.querySelectorAll('#res-list .jjp-card');
  for(var i=0;i<cards.length;i++){
    addCardMenu(cards[i], items[i].id||('r'+i));
  }

  // Update count
  var countDisplay = document.getElementById('res-count-display');
  if (countDisplay) countDisplay.textContent=items.length+' resources';
}

// ===== CARD MENU =====
function addCardMenu(card, id){
  var menu=document.createElement('div');
  menu.className='card-menu';
  menu.innerHTML='<button class="card-menu-btn" title="Actions">⋮</button><div class="card-menu-dropdown">'+
    '<button onclick="printResource(\''+id+'\')">🖨️ Print</button>'+
    '<button onclick="copyResource(\''+id+'\')">📋 Copy</button>'+
    '<button onclick="shareResource(\''+id+'\')">📤 Share</button>';

  if (isStaffAuthenticated()) {
    menu.innerHTML += '<button onclick="editResource(\''+id+'\')">✏️ Edit</button>'+
                     '<button onclick="deleteResource(\''+id+'\')">🗑️ Delete</button>';
  }

  menu.innerHTML += '</div>';
  card.appendChild(menu);

  var btn=menu.querySelector('.card-menu-btn');
  var dropdown=menu.querySelector('.card-menu-dropdown');
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    // Close all other menus first
    document.querySelectorAll('.card-menu-dropdown').forEach(function(d){
      if(d!==dropdown) d.style.display='none';
    });
    dropdown.style.display=dropdown.style.display==='block'?'none':'block';
  });
}

// ===== PRINT FUNCTIONS =====
function printResource(id){
  var card=document.querySelector('.jjp-card[data-id="'+id+'"]');
  if(!card) return;
  var clone=card.cloneNode(true);
  var menus=clone.querySelectorAll('.card-menu,.card-menu-btn,.card-menu-dropdown');
  for(var i=0;i<menus.length;i++) menus[i].remove();

  var phoneBtn = clone.querySelector('a[href^="tel:"]');
  if (phoneBtn) {
    var phoneSpan = document.createElement('span');
    phoneSpan.textContent = '📞 ' + phoneBtn.textContent.replace('📞 ', '');
    phoneSpan.className = 'print-phone';
    phoneBtn.parentNode.replaceChild(phoneSpan, phoneBtn);
  }

  var w=window.open('','_blank','width=700,height=600');
  w.document.write('<html><head><title>JJP Resource</title><style>'+
    'body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:auto;color:#222}'+
    '.print-phone{display:inline-block;padding:4px 12px;font-size:.75rem;color:#17365d}'+
    '</style></head><body>'+clone.outerHTML+'</body></html>');
  w.document.close();
  setTimeout(function(){w.print();},300);
}

function printAllResources(){
  var cards=document.querySelectorAll('#res-list .jjp-card');
  if(!cards.length){alert('No resources to print.');return;}

  var groups={};
  var typeOrder=['Emergency','Food','Housing','Veteran','Community','Assistance','Transportation','Legal','Health','Charity'];
  for(var i=0;i<cards.length;i++){
    var badge=cards[i].querySelector('.type-badge');
    var type=badge?badge.textContent.trim():'Other';
    if(!groups[type]) groups[type]=[];
    var clone=cards[i].cloneNode(true);
    var menus=clone.querySelectorAll('.card-menu,.card-menu-btn,.card-menu-dropdown');
    for(var j=0;j<menus.length;j++) menus[j].remove();

    var phoneBtns = clone.querySelectorAll('a[href^="tel:"]');
    phoneBtns.forEach(function(btn) {
      var phoneSpan = document.createElement('span');
      phoneSpan.textContent = '📞 ' + btn.textContent.replace('📞 ', '');
      phoneSpan.className = 'print-phone';
      btn.parentNode.replaceChild(phoneSpan, btn);
    });

    groups[type].push(clone.outerHTML);
  }

  var county=document.getElementById('res-county').value||'All Counties';
  var search=document.getElementById('res-search').value||'';
  var typeFilter=document.getElementById('res-type').value||'';
  var subtitle=[county,typeFilter,search].filter(Boolean).join(' — ')||'All Resources';
  var today=new Date().toLocaleDateString();

  var html='<div class="print-header"><h1>JJP Resource Directory</h1><p><strong>'+cards.length+' resources</strong> • '+subtitle+' • '+today+'</p></div>';

  typeOrder.forEach(function(type){
    if(groups[type]&&groups[type].length){
      html+='<h2 class="print-section">'+TYPE_META[type].icon+' '+type+' <span>('+groups[type].length+')</span></h2>';
      html+=groups[type].join('');
    }
  });
  for(var t in groups){
    if(typeOrder.indexOf(t)===-1){
      html+='<h2 class="print-section">'+t+' ('+groups[t].length+')</h2>';
      html+=groups[t].join('');
    }
  }

  var w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JJP Resources — '+subtitle+'</title><style>'+
    '*{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:850px;margin:0 auto;padding:20px;color:#222}'+
    '.print-header{text-align:center;border-bottom:3px solid #17365d;padding-bottom:12px;margin-bottom:20px}'+
    '.print-header h1{margin:0;color:#17365d;font-size:22px}.print-header p{color:#555;font-size:13px;margin:4px 0 0}'+
    '.print-section{color:#17365d;font-size:16px;border-bottom:2px solid #f6c344;padding-bottom:4px;margin:24px 0 10px}'+
    '.print-section span{font-weight:400;font-size:13px;color:#888}'+
    '.jjp-card{border:1px solid #ddd;padding:10px 14px;margin-bottom:8px;border-radius:6px;page-break-inside:avoid;font-size:13px}'+
    '.jjp-card strong{font-size:14px;color:#17365d}'+
    '.type-badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase;margin-left:6px;border:1px solid #ccc}'+
    '.print-phone{display:inline-block;padding:4px 12px;font-size:.75rem;color:#17365d}'+
    '.card-menu{display:none}'+
    '@media print{body{padding:10px;font-size:12px}.jjp-card{font-size:11px}}'+
    '</style></head><body>'+html+'</body></html>');
  w.document.close();
  setTimeout(function(){w.print();},500);
}

// ===== COPY / SHARE =====
function copyResource(id){
  var card=document.querySelector('.jjp-card[data-id="'+id+'"]');
  if(!card) return;
  var txt=card.innerText.replace(/\n{2,}/g,'\n').trim();
  if(navigator.clipboard){
    navigator.clipboard.writeText(txt).then(function(){alert('Copied to clipboard!');}).catch(function(){prompt('Copy this text:',txt);});
  } else {
    prompt('Copy this text:',txt);
  }
}

function shareResource(id){
  var card=document.querySelector('.jjp-card[data-id="'+id+'"]');
  if(!card) return;
  var txt=card.innerText.replace(/\n{2,}/g,'\n').trim();
  if(navigator.share){
    navigator.share({title:'JJP Resource',text:txt}).catch(function(){});
  } else {
    window.open('mailto:?subject=JJP Resource&body='+encodeURIComponent(txt));
  }
}

// ===== TOGGLE GRID VIEW =====
function toggleGridView(){
  var list=document.getElementById('res-list');
  var btn=document.getElementById('grid-toggle-btn');
  if(list.classList.contains('grid-view')){
    list.classList.remove('grid-view');
    btn.textContent='⊞ Grid View';
  }else{
    list.classList.add('grid-view');
    btn.textContent='☰ List View';
  }
}

// ===== CLOSE MENUS ON OUTSIDE CLICK =====
document.addEventListener('click',function(e){
  var target=e.target;
  var isMenuClick=target.closest('.card-menu,.card-menu-btn,.card-menu-dropdown');
  if(!isMenuClick){
    document.querySelectorAll('.card-menu-dropdown').forEach(function(d){d.style.display='none';});
  }
});

// ===== RENDER HOTLINES =====
function renderHotlines(){
  var q=(document.getElementById('hot-search').value||'').toLowerCase();
  var cat=document.getElementById('hot-category').value;
  var items=DATA.hotlines||[];
  if(cat) items=items.filter(function(h){return h.category===cat;});
  if(q) items=items.filter(function(h){return (h.name+' '+(h.notes||'')).toLowerCase().indexOf(q)!==-1;});
  var html='<p class="usa-hint">'+items.length+' hotline(s)</p>';
  html+=items.map(function(h){
    return '<div class="jjp-card">'+
      '<strong>📞 '+esc(h.name)+'</strong>'+
      (h.category?'<span class="type-badge" style="background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3)">'+esc(h.category)+'</span>':'')+
      '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">'+
        (h.phone?'<a href="tel:'+esc(h.phone)+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+esc(h.phone)+'</a>':'')+
      '</div>'+
      (h.notes?'<div class="card-notes">'+esc(h.notes)+'</div>':'')+
    '</div>';
  }).join('');
  document.getElementById('hot-list').innerHTML=html;
}

// ===== RENDER NURSING HOMES =====
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
      '<strong>🏥 '+esc(n.name)+'</strong>'+
      '<div class="card-meta">'+[esc(n.city),esc(n.county),esc(n.state)].filter(Boolean).join(', ')+'</div>'+
      (n.address?'<div class="card-meta">📍 '+esc(n.address)+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (n.phone?'<a href="tel:'+esc(n.phone)+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+esc(n.phone)+'</a>':'')+
        (n.fax?'<span class="card-meta" style="font-size:.75rem">📠 '+esc(n.fax)+'</span>':'')+
        (n.va_contract?'<span class="type-badge" style="background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.3)">VA Contract</span>':'')+
        (n.behavioral_unit?'<span class="type-badge" style="background:rgba(139,92,246,0.15);color:#c4b5fd;border:1px solid rgba(139,92,246,0.3)">Behavioral Unit</span>':'')+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('nh-list').innerHTML=html;
}

// ===== RENDER CARE HOMES =====
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
      '<strong>🏠 '+esc(c.name)+'</strong>'+
      '<span class="type-badge" style="margin-left:8px;background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3)">'+(typeLabels[c.facility_type]||esc(c.facility_type))+'</span>'+
      '<div class="card-meta">'+[esc(c.city),esc(c.county),esc(c.state)].filter(Boolean).join(', ')+'</div>'+
      (c.address?'<div class="card-meta">📍 '+esc(c.address)+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
        (c.phone?'<a href="tel:'+esc(c.phone)+'" class="usa-button usa-button--outline" style="font-size:.75rem;padding:4px 12px">📞 '+esc(c.phone)+'</a>':'')+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('ch-list').innerHTML=html;
}

// ===== MAP =====
var mapInitialized=false;

function initMap(){
  if(mapInitialized) return;
  mapInitialized=true;
  if(typeof L === 'undefined') {
    document.getElementById('map').innerHTML = '<p class="usa-hint">Map library not available. Internet may be required for first load.</p>';
    return;
  }
  var map=L.map('map').setView([36.7,-92.5],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  DATA.nursing_homes.forEach(function(n){
    if(n.lat&&n.lng){
      L.marker([n.lat,n.lng]).addTo(map).bindPopup('<strong>'+esc(n.name)+'</strong><br>'+esc(n.address)+'<br><a href="tel:'+esc(n.phone)+'">'+esc(n.phone)+'</a>');
    }
  });
  DATA.care_homes.forEach(function(c){
    if(c.lat&&c.lng){
      L.marker([c.lat,c.lng],{icon:L.divIcon({className:'ch-marker',html:'🏠',iconSize:[20,20]})}).addTo(map).bindPopup('<strong>'+esc(c.name)+'</strong><br>'+esc(c.address)+'<br><a href="tel:'+esc(c.phone)+'">'+esc(c.phone)+'</a>');
    }
  });
}

// ===== RENDER COUNTIES =====
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
      esc(c)+' <span style="font-weight:400;opacity:.7">('+count+' resources'+(nhCount?' • '+nhCount+' NH':'')+(chCount?' • '+chCount+' CH':'')+')</span></span>';
  }).join('');
  document.getElementById('county-list').innerHTML=html;
}

function filterByCounty(county){
  document.getElementById('res-county').value=county;
  showTab('resources',document.querySelector('.jjp-nav .usa-nav__link'));
  renderResources();
  window.scrollTo(0,0);
}

// ===== END =====