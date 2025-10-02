import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [githubConfig, setGithubConfig] = useState({ owner: '', repo: '' });
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in (has token in localStorage)
    const savedToken = localStorage.getItem('telegramApiKey');
    if (savedToken) {
      router.push('/contacts');
    }
    
    // Get GitHub config
    const fetchGithubConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const { repo } = await response.json();
          setGithubConfig(repo);
        } else {
          setError('Gagal ambil konfigurasi GitHub');
        }
      } catch (err) {
        console.error('Error fetching GitHub config:', err);
        setError('Gagal ambil konfigurasi GitHub');
      }
    };
    
    fetchGithubConfig();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!telegramApiKey) {
      setError('API Key bot Telegram wajib diisi ya!');
      return;
    }
    
    if (!githubConfig.owner || !githubConfig.repo) {
      setError('Konfigurasi GitHub belum diatur dengan benar');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Get current chats
      const chatsResponse = await fetch('/api/chats');
      const chats = await chatsResponse.json();
      
      // Add token as a special message
      const tokenMessage = {
        id: chats.length + 1,
        chatId: 0, // Special chat ID for system messages
        user: 'System',
        username: 'system',
        text: `/settoken ${telegramApiKey}`,
        from: 'user',
        timestamp: new Date().toISOString()
      };
      
      const updatedChats = [...chats, tokenMessage];
      
      // Save to GitHub
      const saveResponse = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chats: updatedChats }),
      });
      
      if (!saveResponse.ok) {
        throw new Error('Gagal simpen token ke GitHub');
      }
      
      // Save token to localStorage
      localStorage.setItem('telegramApiKey', telegramApiKey);
      
      // Redirect to contacts page
      router.push('/contacts');
    } catch (err) {
      console.error('Error saving token:', err);
      setError('Gagal simpen API Key. Coba lagi ya!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
            Telegram Lite
          </h1>
          <p className="mt-2 text-gray-600">
            Chat pake Telegram tapi lebih simpel!
          </p>
          {githubConfig.owner && githubConfig.repo && (
            <p className="mt-2 text-sm text-gray-500">
              Terhubung ke repository: {githubConfig.owner}/{githubConfig.repo}
            </p>
          )}
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="telegram-api-key" className="block text-sm font-medium text-gray-700 mb-1">
                API Key Bot Telegram
              </label>
              <div className="relative">
                <input
                  id="telegram-api-key"
                  name="telegramApiKey"
                  type={showPassword ? "text" : "password"}
                  required
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="Masukin API Key bot kamu..."
                  value={telegramApiKey}
                  onChange={(e) => setTelegramApiKey(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                API Key bisa didapet dari <span className="font-medium">@BotFather</span> di Telegram
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Lagi nyimpen...
                  </span>
                ) : 'Masuk'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="text-center text-sm text-gray-500">
          <p> Telegram Lite • By Vortex</p>
        </div>
      </div>
    </div>
  );
}
