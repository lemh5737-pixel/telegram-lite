// Get chats from GitHub repo
export async function getChats(token, owner, repo, path = 'chats.json') {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
        },
      }
    );
    
    if (response.status === 404) {
      // If file doesn't exist, return empty array
      return [];
    }
    
    const data = await response.json();
    
    if (response.ok) {
      // Decode base64 content
      const content = JSON.parse(atob(data.content));
      return content;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error getting chats from GitHub:', error);
    return [];
  }
}

// Save chats to GitHub repo
export async function saveChats(token, owner, repo, chats, path = 'chats.json', message = 'Update chats') {
  try {
    // First, get the current file to get its SHA
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
        },
      }
    );
    
    let sha = null;
    
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
    }
    
    // Encode content to base64
    const content = btoa(JSON.stringify(chats, null, 2));
    
    // Create or update file
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          content,
          sha,
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error saving chats to GitHub:', error);
    return null;
  }
}
