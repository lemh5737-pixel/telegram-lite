import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [githubToken, setGithubToken] = useState('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');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const savedTelegramApiKey = localStorage.getItem('telegramApiKey');
    const savedGithubToken = localStorage.getItem('githubToken');
    
    if (savedTelegramApiKey && savedGithubToken) {
      router.push('/chat');
    }
  }, [router]);

  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!telegramApiKey || !githubToken) {
      setError('Both API Key and GitHub Token are required');
      return;
    }
    
    // Save tokens to localStorage
    localStorage.setItem('telegramApiKey', telegramApiKey);
    localStorage.setItem('githubToken', githubToken);
    
    // Redirect to chat page
    router.push('/chat');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Telegram Lite
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Login with your Telegram Bot API and GitHub Token
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="telegram-api-key" className="sr-only">
                Telegram Bot API Key
              </label>
              <input
                id="telegram-api-key"
                name="telegramApiKey"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Telegram Bot API Key"
                value={telegramApiKey}
                onChange={(e) => setTelegramApiKey(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="github-token" className="sr-only">
                GitHub Personal Access Token
              </label>
              <input
                id="github-token"
                name="githubToken"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="GitHub Personal Access Token"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
    }
