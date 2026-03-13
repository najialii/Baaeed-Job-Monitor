// DOM elements
const monitorToggle = document.getElementById('monitorToggle');
const lastCheckEl = document.getElementById('lastCheck');
const nextCheckEl = document.getElementById('nextCheck');
const jobListEl = document.getElementById('jobList');
const checkNowBtn = document.getElementById('checkNowBtn');

// Initialize popup
function init() {
  loadSettings();
  loadJobs();
  
  // Set up event listeners
  monitorToggle.addEventListener('change', handleToggle);
  checkNowBtn.addEventListener('click', handleCheckNow);
  
  // Update UI every second
  setInterval(updateTimeDisplay, 1000);
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['monitorEnabled', 'lastCheck'], (result) => {
    monitorToggle.checked = result.monitorEnabled !== false;
    updateLastCheck(result.lastCheck);
  });
}

// Load recent jobs
function loadJobs() {
  chrome.storage.local.get(['recentJobs'], (result) => {
    const jobs = result.recentJobs || [];
    displayJobs(jobs.slice(0, 3));
  });
}

// Display jobs in the list
function displayJobs(jobs) {
  if (jobs.length === 0) {
    jobListEl.innerHTML = '<div class="empty-state">لا توجد وظائف جديدة حتى الآن</div>';
    return;
  }
  
  jobListEl.innerHTML = jobs.map(job => `
    <div class="job-item" data-url="${job.url}">
      <div class="job-title">${escapeHtml(job.title)}</div>
      <div class="job-time">${formatTime(job.timestamp)}</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.job-item').forEach(item => {
    item.addEventListener('click', () => {
      chrome.tabs.create({ url: item.dataset.url });
    });
  });
}

// Handle monitor toggle
function handleToggle() {
  const enabled = monitorToggle.checked;
  
  chrome.storage.local.set({ monitorEnabled: enabled });
  
  chrome.runtime.sendMessage({
    action: 'toggleMonitor',
    enabled: enabled
  });
  
  updateTimeDisplay();
}

// Handle check now button
function handleCheckNow() {
  checkNowBtn.disabled = true;
  checkNowBtn.textContent = 'جاري الفحص...';
  
  chrome.runtime.sendMessage({ action: 'checkNow' });
  
  setTimeout(() => {
    checkNowBtn.disabled = false;
    checkNowBtn.textContent = 'فحص الآن';
    loadSettings();
    loadJobs();
  }, 2000);
}

// Update last check display
function updateLastCheck(timestamp) {
  if (!timestamp) {
    lastCheckEl.textContent = 'لم يتم الفحص بعد';
    return;
  }
  
  lastCheckEl.textContent = formatTime(timestamp);
}

// Update time display
function updateTimeDisplay() {
  chrome.storage.local.get(['lastCheck', 'monitorEnabled'], (result) => {
    updateLastCheck(result.lastCheck);
    
    if (result.monitorEnabled && result.lastCheck) {
      const lastCheck = new Date(result.lastCheck);
      const nextCheck = new Date(lastCheck.getTime() + 20 * 60 * 1000);
      const now = new Date();
      
      if (nextCheck > now) {
        const diff = Math.floor((nextCheck - now) / 1000 / 60);
        nextCheckEl.textContent = `بعد ${diff} دقيقة`;
      } else {
        nextCheckEl.textContent = 'قريباً';
      }
    } else {
      nextCheckEl.textContent = '--';
    }
  });
}

// Format timestamp
function formatTime(timestamp) {
  if (!timestamp) return '--';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  
  return date.toLocaleDateString('ar-SA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
