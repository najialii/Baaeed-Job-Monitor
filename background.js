const ALARM_NAME = 'baaeedJobCheck';
const CHECK_INTERVAL = 20;
const BAAEED_URL = 'https://baaeed.com/remote-jobs';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['monitorEnabled'], (result) => {
    if (result.monitorEnabled !== false) {
      createAlarm();
      chrome.storage.local.set({ monitorEnabled: true });
    }
  });
});

function createAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL
  });
}

function clearAlarm() {
  chrome.alarms.clear(ALARM_NAME);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForNewJobs();
  }
});

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
    
    chrome.storage.local.set({
      lastCheck: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking jobs:', error);
  }
}

function parseJobs(html) {
  const jobs = [];
  const jobPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const jobMatches = html.match(jobPattern) || [];
  
  jobMatches.forEach((jobHtml) => {
    if (jobHtml.includes('جديد')) {
      const urlMatch = jobHtml.match(/href="(https:\/\/baaeed\.com\/remote-jobs\/[^"]+)"/i);
      if (!urlMatch) return;
      
      const url = urlMatch[1];
      const jobId = extractJobId(url);
      
      const titleMatch = jobHtml.match(/<a[^>]*href="https:\/\/baaeed\.com\/remote-jobs\/[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
      let title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      const dateMatch = jobHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>\s*([^<]+)\s*<\/time>/i);
      const dateText = dateMatch ? dateMatch[2].trim() : '';
      
      if (title && url) {
        jobs.push({
          id: jobId,
          title: title,
          url: url,
          date: dateText,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  return jobs;
}

function extractJobId(url) {
  const match = url.match(/\/(\d+)/);
  return match ? match[1] : url;
}

async function filterNewJobs(jobs) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['seenJobIds'], (result) => {
      const seenIds = result.seenJobIds || [];
      const newJobs = jobs.filter(job => !seenIds.includes(job.id));
      resolve(newJobs);
    });
  });
}

async function storeNewJobs(newJobs) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['seenJobIds', 'recentJobs'], (result) => {
      const seenIds = result.seenJobIds || [];
      const recentJobs = result.recentJobs || [];
      
      newJobs.reverse().forEach(job => {
        if (!seenIds.includes(job.id)) {
          seenIds.push(job.id);
          recentJobs.unshift(job);
        }
      });
      
      const trimmedSeenIds = seenIds.slice(-50);
      const trimmedRecentJobs = recentJobs.slice(0, 20);
      
      chrome.storage.local.set({
        seenJobIds: trimmedSeenIds,
        recentJobs: trimmedRecentJobs
      }, resolve);
    });
  });
}

function notifyNewJobs(jobs) {
  jobs.forEach((job, index) => {
    setTimeout(() => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="%2300bfa5" width="128" height="128" rx="16"/><text x="64" y="80" font-size="60" text-anchor="middle" fill="white">💼</text></svg>',
        title: 'وظيفة جديدة في بعيد',
        message: job.title,
        priority: 2
      });
    }, index * 1000);
  });
}
