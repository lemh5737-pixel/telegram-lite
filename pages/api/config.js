import { GITHUB_REPO } from '../../lib/config';

export default function handler(req, res) {
  // Check if the GitHub configuration is properly set
  if (!GITHUB_REPO.owner || !GITHUB_REPO.repo) {
    return res.status(500).json({ 
      message: 'GitHub configuration is not properly set in environment variables' 
    });
  }
  
  res.status(200).json({
    repo: GITHUB_REPO
  });
}
