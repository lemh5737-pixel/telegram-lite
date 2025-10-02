import { GITHUB_REPO } from '../../lib/config';

export default function handler(req, res) {
  res.status(200).json({
    repo: GITHUB_REPO
  });
}
