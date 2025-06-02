// Log initialization message
console.log('Hello from Sourabh - Background script initialized');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'extractContacts') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      console.log('Sending message to content script:', request);
      chrome.tabs.sendMessage(tabs[0].id, request, response => {
        console.log('Received response from content script:', response);
        sendResponse(response);
      });
    });
    return true; // Keep message channel open for async response
  }
});