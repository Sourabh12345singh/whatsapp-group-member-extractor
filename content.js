function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

function getTextContent(element) {
  return element?.textContent?.trim() || '';
}

function getAttribute(element, attr) {
  return element?.getAttribute(attr) || '';
}

function promptUserToScroll() {
  alert('Please scroll to the bottom of the member list in the popup to load all members. Extraction will start in 30 seconds.');
}

function downloadCSV(groupName, members) {
  const headers = ['Group Name', 'Member Name', 'Phone Number', 'Is Admin'];
  const rows = members.map(member => [
    `"${groupName}"`,
    `"${member.name}"`,
    member.phone ? `"${member.phone}"` : '',
    member.isAdmin ? 'Yes' : 'No'
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${groupName.replace(/[^a-z0-9]/gi, '_')}_members.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function extractMemberDetails(member, uniqueMembers) {
  let name = '';
  const nameElements = member.querySelectorAll('span[dir="auto"], div[title], div[aria-label], span');
  for (const el of nameElements) {
    const text = getTextContent(el) || getAttribute(el, 'title') || getAttribute(el, 'aria-label');
    if (text && text.length > 2 && !text.includes('member') && !text.match(/^\+?\d{5,}$/)) {
      name = text;
      break;
    }
  }

  let phone = '';
  const phoneElements = member.querySelectorAll('span, div');
  for (const el of phoneElements) {
    const text = getTextContent(el);
    if (text && text !== name && text.match(/^\+?\d{5,}$/)) {
      phone = text;
      break;
    }
  }

  const isAdmin = !!member.querySelector('span[data-icon="admin"], div[title*="admin" i], span[title*="admin" i]');
  const memberKey = name + phone;

  if (name && !uniqueMembers.has(memberKey)) {
    uniqueMembers.add(memberKey);
    return { name, phone, isAdmin };
  }
  return null;
}

async function extractGroupMembers() {
  try {
    console.log('Starting extraction...');
    
    // Try multiple selectors for group info panel
    const groupInfoPanel = await waitForElement([
      'div[aria-label*="Group info"]',
      'div[aria-label*="group info"]',
      'header[aria-label*="Group"]',
      'header[aria-label*="group"]',
      'div[data-testid="conversation-info-header"]'
    ].join(','), 15000);

    // Try multiple methods to get group name
    let groupName = 'Unknown Group';
    
    // Method 1: Try aria-label attribute
    const ariaLabel = getAttribute(groupInfoPanel, 'aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/for "(.+?)"/) || ariaLabel.match(/group info for (.+)/i);
      if (match) {
        groupName = match[1];
      }
    }

    // Method 2: Try title attribute
    if (groupName === 'Unknown Group') {
      const title = getAttribute(groupInfoPanel, 'title');
      if (title && !title.includes('member')) {
        groupName = title;
      }
    }

    // Method 3: Try header text content
    if (groupName === 'Unknown Group') {
      const headerText = getTextContent(groupInfoPanel.querySelector('span[dir="auto"], div[title], div[aria-label]'));
      if (headerText && !headerText.includes('member')) {
        groupName = headerText;
      }
    }

    // Method 4: Try specific WhatsApp Web selectors
    if (groupName === 'Unknown Group') {
      const specificSelectors = [
        'div[data-testid="conversation-info-header"] span[dir="auto"]',
        'div[data-testid="conversation-info-header"] div[title]',
        'div[data-testid="conversation-info-header"] div[aria-label]'
      ];
      
      for (const selector of specificSelectors) {
        const element = groupInfoPanel.querySelector(selector);
        if (element) {
          const text = getTextContent(element);
          if (text && !text.includes('member')) {
            groupName = text;
            break;
          }
        }
      }
    }

    console.log('Group name:', groupName);

    const viewAllButton = Array.from(document.querySelectorAll('div, button, span')).find(el => {
      const text = getTextContent(el).toLowerCase();
      return text.includes('view all') || text.includes('see all') || text.includes('more') || text.includes('members');
    });

    if (!viewAllButton) {
      console.log('No "View All" button found');
      return { groupName, members: [] };
    }

    console.log('Clicking "View All" button...');
    viewAllButton.click();

    const popupContainer = await waitForElement('div[role="dialog"], div[aria-modal="true"]', 15000);
    console.log('Popup loaded');

    let memberContainer = popupContainer.querySelector('div[role="list"], div.x1y332i5, div[aria-label*="members" i]');
    if (!memberContainer) {
      console.log('Primary container not found, trying fallback...');
      const possibleContainers = Array.from(popupContainer.querySelectorAll('div')).filter(
        div => div.querySelectorAll('div[role="listitem"], div.x1016tqk').length > 0
      );
      memberContainer = possibleContainers[0];
      if (!memberContainer) {
        console.error('Member list container not found');
        return { groupName, members: [] };
      }
    }
    console.log('Member container found');

    promptUserToScroll();

    const uniqueMembers = new Set();
    const members = [];

    const observer = new MutationObserver(() => {
      const newMembers = memberContainer.querySelectorAll('div[role="listitem"], div.x1016tqk.xh8yej3.x1g42fcv');
      console.log(`Detected ${newMembers.length} members in DOM`);
      newMembers.forEach(member => {
        const memberData = extractMemberDetails(member, uniqueMembers);
        if (memberData && !members.some(m => m.name === memberData.name && m.phone === memberData.phone)) {
          members.push(memberData);
          console.log(`Extracted ${members.length} unique member${members.length > 1 ? 's' : ''}`);
        }
      });
    });

    observer.observe(memberContainer, { childList: true, subtree: true });

    console.log('Monitoring for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    observer.disconnect();
    console.log(`Total unique members extracted: ${members.length}`);

    if (members.length > 0) downloadCSV(groupName, members);
    else console.warn('No members extracted');

    return { groupName, members };
  } catch (error) {
    console.error('Extraction error:', error);
    return { groupName: 'Error', members: [] };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractGroupMembers') {
    extractGroupMembers()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});