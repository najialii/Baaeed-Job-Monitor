const monitorToggle = document.getElementById('monitorToggle');
const lastCheckEl = document.getElementById('lastCheck');
const nextCheckEl = document.getElementById('nextCheck');
const jobListEl = document.getElementById('jobList');
const checkNowBtn = document.getElementById('checkNowBtn');

function init() {
  loadSettings();
  loadJobs();
  monitorToggle.addEventListener('change', handleToggle);
  checkNowBtn.addEventListener('click', handleCheckNow);
  setInterval(updateTimeDisplay, 1000);
}

function loadSettings() {
  chrome.storage.local.get(['monitorEnabled', 'lastCheck'], (result) => {
    monitorToggle.checked = result.monitorEnabled !== false;
    updateLastCheck(result.lastCheck);
  });
}

function loadJobs() {
  chrome.storage.local.get(['recentJobs'], (result) => {
    const jobs = result.recentJobs || [];
    displayJobs(jobs);
  });
}

function displayJobs(jobs) {
  if (jobs.length === 0) {
    jobListEl.innerHTML = '<div class="empty-state">لا توجد وظائف جديدة حتى الآن</div>';
    return;
  }
  
  jobListEl.innerHTML = jobs.map(job => `
    <div class="job-item" data-url="${job.url}">
      <div class="job-title">${escapeHtml(job.title)}</div>
      <div class="job-time">${job.date || formatTime(job.timestamp)}</div>
    </div>
  `).join('');
  
  document.querySelectorAll('.job-item').forEach(item => {
    item.addEventListener('click', () => {
      chrome.tabs.create({ url: item.dataset.url });
    });
  });
}

function handleToggle() {
  const enabled = monitorToggle.checked;
  chrome.storage.local.set({ monitorEnabled: enabled });
  chrome.runtime.sendMessage({
    action: 'toggleMonitor',
    enabled: enabled
  });
  updateTimeDisplay();
}

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

function updateLastCheck(timestamp) {
  if (!timestamp) {
    lastCheckEl.textContent = 'لم يتم الفحص بعد';
    return;
  }
  lastCheckEl.textContent = formatTime(timestamp);
}

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
