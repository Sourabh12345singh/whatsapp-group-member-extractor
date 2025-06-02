// DOM Elements
const extractBtn = document.getElementById('extractBtn');
const status = document.getElementById('status');
const loading = document.getElementById('loading');

// Utility functions
function showStatus(message, isError = false) {
  status.textContent = message;
  status.className = 'status ' + (isError ? 'error' : 'success');
  status.style.display = 'block';
  setTimeout(() => {
    status.style.display = 'none';
  }, 5000);
}

function setLoading(isLoading) {
  loading.style.display = isLoading ? 'block' : 'none';
  extractBtn.disabled = isLoading;
}

function downloadCSV(data) {
  const { groupName, members } = data;
  
  // Create CSV content
  const headers = ['Name', 'Phone', 'Admin'];
  const rows = members.map(member => [
    `"${member.name.replace(/"/g, '""')}"`,
    `"${member.phone.replace(/"/g, '""')}"`,
    member.isAdmin ? 'Yes' : 'No'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${groupName}_members.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized');

  // Handle extract button click
  extractBtn.addEventListener('click', async () => {
    try {
      setLoading(true);
      showStatus('Starting extraction...');

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      // Check if we're on WhatsApp Web
      if (!tab.url.includes('web.whatsapp.com')) {
        throw new Error('Please open WhatsApp Web first');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'extractGroupMembers'
      });
      
      if (response.success) {
        const { groupName, members } = response.data;
        if (members.length > 0) {
          downloadCSV({ groupName, members });
          showStatus(`Successfully extracted ${members.length} members from ${groupName}`);
        } else {
          showStatus('No members found in the group', true);
        }
      } else {
        showStatus(response.error || 'Failed to extract members', true);
      }
    } catch (error) {
      console.error('Error:', error);
      showStatus(error.message || 'Error: Make sure you are on WhatsApp Web', true);
    } finally {
      setLoading(false);
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showPopup') {
    showStatus(request.message);
  }
}); 