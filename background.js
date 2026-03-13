const ALARM_NAME = 'baaeedJobCheck';
const CHECK_INTERVAL = 20; // minutes
const BAAEED_URL = 'https://baaeed.com/remote-jobs';

// Initialize alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['monitorEnabled'], (result) => {
    if (result.monitorEnabled !== false) {
      createAlarm();
      chrome.storage.local.set({ monitorEnabled: true });
    }
  });
});

// Create alarm
function createAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL
  });
}

// Clear alarm
function clearAlarm() {
  chrome.alarms.clear(ALARM_NAME);
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForNewJobs();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'toggleMonitor') {
    if (request.enabled) {
      createAlarm();
      checkForNewJobs();
    } else {
      clearAlarm();
    }
  } else if (request.action === 'checkNow') {
    checkForNewJobs();
  }
});

// Main function to check for new jobs
async function checkForNewJobs() {
  try {
    const response = await fetch(BAAEED_URL);
    const html = await response.text();
    
    const jobs = parseJobs(html);
    const newJobs = await filterNewJobs(jobs);
    
    if (newJobs.length > 0) {
      await storeNewJobs(newJobs);
      notifyNewJobs(newJobs);
    }
    
    // Update last check time
    chrome.storage.local.set({
      lastCheck: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking jobs:', error);
  }
}

// Parse jobs from HTML
function parseJobs(html) {
  const jobs = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find all job listings with "جديد" badge
  const jobElements = doc.querySelectorAll('.job-item, .job-card, [class*="job"]');
  
  jobElements.forEach((element) => {
    const hasNewBadge = element.textContent.includes('جديد');
    
    if (hasNewBadge) {
      const titleElement = element.querySelector('h2, h3, .job-title, [class*="title"]');
      const linkElement = element.querySelector('a');
      
      if (titleElement && linkElement) {
        const jobId = extractJobId(linkElement.href);
        const title = titleElement.textContent.trim();
        
        jobs.push({
          id: jobId,
          title: title,
          url: linkElement.href,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  return jobs;
}

// Extract job ID from URL
function extractJobId(url) {
  const match = url.match(/\/(\d+)/);
  return match ? match[1] : url;
}

// Filter out already seen jobs
async function filterNewJobs(jobs) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['seenJobIds'], (result) => {
      const seenIds = result.seenJobIds || [];
      const newJobs = jobs.filter(job => !seenIds.includes(job.id));
      resolve(newJobs);
    });
  });
}

// Store new jobs
async function storeNewJobs(newJobs) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['seenJobIds', 'recentJobs'], (result) => {
      const seenIds = result.seenJobIds || [];
      const recentJobs = result.recentJobs || [];
      
      newJobs.forEach(job => {
        if (!seenIds.includes(job.id)) {
          seenIds.push(job.id);
          recentJobs.unshift(job);
        }
      });
      
      // Keep only last 50 seen IDs and last 10 recent jobs
      const trimmedSeenIds = seenIds.slice(-50);
      const trimmedRecentJobs = recentJobs.slice(0, 10);
      
      chrome.storage.local.set({
        seenJobIds: trimmedSeenIds,
        recentJobs: trimmedRecentJobs
      }, resolve);
    });
  });
}

// Send notifications for new jobs
function notifyNewJobs(jobs) {
  jobs.forEach((job, index) => {
    setTimeout(() => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'وظيفة جديدة في بعيد',
        message: job.title,
        priority: 2
      });
    }, index * 1000);
  });
}
