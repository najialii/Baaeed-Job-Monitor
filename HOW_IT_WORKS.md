# How Baaeed Job Monitor Works

## Overview
This Chrome extension monitors Baaeed's remote jobs page every 20 minutes and notifies you when new jobs with the "جديد" (New) badge appear.

## Architecture

### 1. Background Service Worker (`background.js`)
The heart of the extension runs continuously in the background.

**Key Components:**

- **Chrome Alarms API**: Sets up a timer that triggers every 20 minutes
  ```javascript
  chrome.alarms.create('baaeedJobCheck', { periodInMinutes: 20 });
  ```

- **Fetch & Parse**: When the alarm fires, it:
  1. Fetches the HTML from `https://baaeed.com/remote-jobs`
  2. Uses regex to find all `<tr>` (table row) elements
  3. Filters rows that contain the text "جديد"
  4. Extracts job title and URL from matching rows

- **Deduplication**: 
  - Stores seen job IDs in `chrome.storage.local`
  - Only notifies about jobs that haven't been seen before
  - Keeps last 50 job IDs to prevent duplicates

- **Notifications**:
  - Creates Chrome notifications for each new job
  - Shows job title in Arabic
  - Delays each notification by 1 second to avoid spam

### 2. Popup UI (`popup.html` + `popup.js`)
The interface you see when clicking the extension icon.

**Features:**

- **Toggle Switch**: Enable/disable the background monitor
- **Last Check Time**: Shows when the extension last checked for jobs
- **Next Check Timer**: Countdown to the next automatic check
- **Check Now Button**: Manually trigger a check immediately
- **Recent Jobs List**: Shows the last 3 new jobs found (clickable to open)

**How it communicates:**
```javascript
chrome.runtime.sendMessage({ action: 'checkNow' });
```
Sends messages to the background worker to trigger actions.

### 3. Data Flow

```
[Chrome Alarm fires every 20 min]
         ↓
[Fetch Baaeed HTML]
         ↓
[Parse with Regex to find "جديد" jobs]
         ↓
[Check against stored job IDs]
         ↓
[New jobs found?] → Yes → [Store IDs + Show notification]
         ↓
[Update last check time]
```

### 4. Storage Structure

**chrome.storage.local** stores:
- `monitorEnabled`: boolean - Is monitoring active?
- `lastCheck`: ISO timestamp - When was the last check?
- `seenJobIds`: array - List of job IDs already seen (max 50)
- `recentJobs`: array - Last 10 jobs found with full details

### 5. HTML Parsing Strategy

Since DOMParser isn't available in service workers, we use regex:

```javascript
// Find all table rows
/<tr[^>]*>[\s\S]*?<\/tr>/gi

// Extract job URL
/href="(https:\/\/baaeed\.com\/remote-jobs\/[^"]+)"/i

// Extract job title
/<a[^>]*href="https:\/\/baaeed\.com\/remote-jobs\/[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/i
```

The extension looks for rows containing "جديد", then extracts the job link and title from the HTML structure.

### 6. Permissions Required

- `alarms`: Schedule periodic checks
- `notifications`: Show desktop notifications
- `storage`: Store seen job IDs and settings
- `https://baaeed.com/*`: Access to fetch the jobs page

## User Journey

1. **Install**: Extension auto-enables monitoring
2. **First Check**: Happens immediately on install
3. **Every 20 Minutes**: Automatic background check
4. **New Job Found**: Desktop notification appears
5. **Click Notification**: Opens job page in new tab
6. **Open Popup**: See recent jobs and control settings

## Why Every 20 Minutes?

Chrome extensions have limits on alarm frequency. 20 minutes is a good balance between:
- Not missing new jobs
- Not overloading Baaeed's servers
- Staying within Chrome's resource limits
