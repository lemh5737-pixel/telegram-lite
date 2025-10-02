import { getUsers, saveUsers } from '../../lib/github';
import { GITHUB_TOKEN, GITHUB_REPO } from '../../lib/config';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const users = await getUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
      res.status(200).json(users);
    } else if (req.method === 'POST') {
      const { users } = req.body;
      const result = await saveUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, users);
      res.status(200).json(result);
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
