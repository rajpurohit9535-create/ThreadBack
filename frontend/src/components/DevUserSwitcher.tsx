import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, Check, RefreshCw, UserCheck, Code } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { apiClient, UserDto } from '../api/client';
import { useToast } from './Toast';

export const DevUserSwitcher: React.FC = () => {
  // Only display in development mode
  if (!import.meta.env.DEV) return null;

  const { currentUser, switchMockUser } = useCanvasStore();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [devUsers, setDevUsers] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.listDevUsers();
      setDevUsers(res.users);
    } catch {
      // Dev users endpoint only available in dev
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleSelectUser = async (user: UserDto) => {
    if (currentUser?.id === user.id) {
      setIsOpen(false);
      return;
    }

    try {
      await switchMockUser(user.id);
      showToast(`Switched mock account to ${user.name} (${user.email})`, 'success');
      setIsOpen(false);
    } catch {
      showToast(`Failed to switch to ${user.name}`, 'error');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
        title="Developer control: switch between registered mock accounts"
      >
        <Code className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-mono text-[11px] font-bold">Developer: Switch Mock User</span>
        <ChevronDown className={`w-3 h-3 text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#16161a] border border-slate-700/80 rounded-2xl shadow-2xl p-3 space-y-2 z-50 animate-in fade-in zoom-in-95 text-slate-200">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Mock Collaboration Switcher
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Test multi-user isolation by switching active sessions.
              </p>
            </div>
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh registered accounts list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {devUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {isLoading ? 'Loading accounts...' : 'No other mock accounts registered yet. Register a second account via Sign In to test switching!'}
              </div>
            ) : (
              devUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200 font-semibold'
                        : 'hover:bg-slate-800/80 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 border border-slate-700'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
                        <UserCheck className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 group-hover:text-slate-300 shrink-0">
                        Switch →
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 px-2 flex justify-between items-center">
            <span>Dev Mode: Simulated accounts only</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
