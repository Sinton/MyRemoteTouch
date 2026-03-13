import React from 'react';
import { useTheme, BackgroundMode } from '../context/ThemeContext';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ visible, onClose }) => {
  const { theme, setTheme } = useTheme();
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  // Auto-cancel confirmation after 3s
  React.useEffect(() => {
    if (confirmReset) {
      const timer = setTimeout(() => setConfirmReset(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmReset]);

  // Toast timer
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    // Simulate API call
    setTimeout(() => {
      setCheckingUpdate(false);
      setToast('当前已是最新版本');
    }, 1500);
  };

  const handleModeChange = (mode: BackgroundMode) => {
    setTheme(prev => ({ ...prev, backgroundMode: mode }));
  };

  return (
    <div
      className={`fixed top-0 right-[-320px] w-[300px] h-screen bg-[rgba(30,30,35,0.7)] backdrop-blur-[40px] saturate-[180%] border-l border-[rgba(255,255,255,0.1)] shadow-[-10px_0_30px_rgba(0,0,0,0.3)] z-[1000] transition-transform duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] box-border text-white flex flex-col
        ${visible ? 'translate-x-[-320px]' : ''}`}
    >
      {/* Custom Toast Alert - Stay fixed at top of drawer */}
      {toast && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1100] animate-[fade-in_0.3s_ease-out] w-max">
          <div className="bg-[#0A84FF] text-white px-4 py-2 rounded-full text-xs font-black shadow-[0_8px_20px_rgba(10,132,255,0.4)] backdrop-blur-md border border-white/20 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            {toast}
          </div>
        </div>
      )}

      {/* Internal Scrollable Wrapper */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar-wrapper">
        {/* Header */}
        <div className="flex justify-between items-center mb-10 px-1">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-4 bg-[#0A84FF] rounded-full shadow-[0_0_10px_rgba(10,132,255,0.4)]" />
            <h3 className="m-0 text-[15px] font-black tracking-tight bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">系统配置</h3>
          </div>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.1] text-gray-500 hover:text-white hover:bg-white/[0.1] active:scale-90 transition-all cursor-pointer"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="drawer-content space-y-10 pb-10">
          {/* Section: Output Info (Card Style) */}
          <section className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6 shadow-2xl backdrop-blur-3xl">
            <label className="flex items-center gap-2 text-[14px] text-white/40 mb-6 font-black uppercase tracking-[0.1em] px-1">
              <svg className="w-3.5 h-3.5 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" /></svg> 画面输出
            </label>

            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <span className="text-[13px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">解析速率</span>
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/[0.05]">
                  <span className="text-[11px] font-black text-white/40 tracking-tighter uppercase">Ultra High</span>
                  <div className="w-1.5 h-1.5 bg-[#0A84FF] rounded-full animate-pulse shadow-[0_0_8px_rgba(10,132,255,0.5)]" />
                </div>
              </div>
              <div className="flex items-center justify-between group">
                <span className="text-[13px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">画面比例</span>
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.05] text-[11px] font-bold text-white/80 select-none">
                  Original
                </div>
              </div>
            </div>
          </section>

          {/* Section: Personalization (Card Style) */}
          <section className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6 shadow-2xl backdrop-blur-3xl">
            <label className="flex items-center gap-2 text-[14px] text-white/40 mb-6 font-black uppercase tracking-[0.1em] px-1">
              <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg> 个性化氛围
            </label>

            {/* Custom Mode Switcher */}
            <div className="flex bg-black/40 p-1 rounded-xl mb-8 border border-white/[0.05] relative overflow-hidden">
              {['liquid', 'solid', 'gradient'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode as any)}
                  className={`flex-1 py-1.5 text-[11px] font-black z-10 rounded-lg transition-all duration-300 relative
                    ${theme.backgroundMode === mode ? 'text-white' : 'text-white/20 hover:text-white/50'}`}
                >
                  {theme.backgroundMode === mode && (
                    <div className="absolute inset-0 bg-[#0A84FF] rounded-lg shadow-[0_0_20px_rgba(10,132,255,0.4)] animate-[fade-in_0.2s_ease-out] -z-10" />
                  )}
                  {mode === 'liquid' ? '流光' : mode === 'solid' ? '纯色' : '渐变'}
                </button>
              ))}
            </div>

            {/* Conditional Controls with Smooth Transition Simulation */}
            <div className="min-h-[140px] transition-all duration-500 ease-in-out">
              <div className="space-y-6 animate-[fade-in_0.4s_ease-out]">
                {theme.backgroundMode === 'liquid' && (
                  <>
                    {[
                      { id: 'blob1Color', label: '北极极光' },
                      { id: 'blob2Color', label: '深海流体' },
                      { id: 'blob3Color', label: '霓虹暗斑' }
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between group">
                        <span className="text-[13px] font-bold text-white/40 group-hover:text-white/80 transition-colors uppercase tracking-wider">{item.label}</span>
                        <div className="relative group/color">
                          <div
                            className="w-12 h-6 rounded-full border-2 border-white/20 group-hover/color:border-white shadow-lg transition-all active:scale-90 cursor-pointer overflow-hidden ring-4 ring-black/20"
                            style={{ backgroundColor: (theme as any)[item.id] }}
                          >
                            <input
                              type="color"
                              value={(theme as any)[item.id]}
                              onChange={(e) => setTheme(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="absolute inset-x-0 inset-y-0 scale-[3] opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {theme.backgroundMode === 'solid' && (
                  <div className="flex items-center justify-between group">
                    <span className="text-[13px] font-bold text-white/40 group-hover:text-white/80 transition-colors uppercase tracking-wider">画布基底</span>
                    <div className="relative group/color">
                      <div
                        className="w-12 h-6 rounded-full border-2 border-white/20 group-hover/color:border-white shadow-lg transition-all active:scale-95 cursor-pointer overflow-hidden ring-4 ring-black/20"
                        style={{ backgroundColor: theme.solidColor }}
                      >
                        <input type="color" value={theme.solidColor} onChange={(e) => setTheme(prev => ({ ...prev, solidColor: e.target.value }))} className="absolute inset-x-0 inset-y-0 scale-[3] opacity-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}

                {theme.backgroundMode === 'gradient' && (
                  <>
                    {[
                      { id: 'gradientStart', label: '由(起始)' },
                      { id: 'gradientEnd', label: '至(结束)' }
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between group">
                        <span className="text-[13px] font-bold text-white/40 group-hover:text-white/80 transition-colors uppercase tracking-wider">{item.label}</span>
                        <div className="relative group/color">
                          <div
                            className="w-12 h-6 rounded-full border-2 border-white/20 group-hover/color:border-white shadow-lg transition-all active:scale-90 cursor-pointer overflow-hidden ring-4 ring-black/20"
                            style={{ backgroundColor: (theme as any)[item.id] }}
                          >
                            <input type="color" value={(theme as any)[item.id]} onChange={(e) => setTheme(prev => ({ ...prev, [item.id]: e.target.value }))} className="absolute inset-x-0 inset-y-0 scale-[3] opacity-0 cursor-pointer" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Section: About (Card Style) */}
          <section className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6 shadow-2xl backdrop-blur-3xl">
            <label className="flex items-center gap-2 text-[14px] text-white/40 mb-6 font-black uppercase tracking-[0.1em] px-1">
              <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg> 关于产品
            </label>

            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <span className="text-[13px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">程序版本</span>
                <span className="text-[11px] font-black text-white/30 tracking-widest leading-none">V0.1.0-BETA</span>
              </div>
              <a
                href="https://github.com/Sinton/MyRemoteTouch"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between group cursor-pointer no-underline"
              >
                <span className="text-[13px] font-semibold text-white/50 group-hover:text-white transition-colors">开源主页</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-white/40 tracking-widest leading-none border-b border-white/10 group-hover:border-[#0A84FF] group-hover:text-[#0A84FF] transition-all">GitHub</span>
                  <svg className="w-3 h-3 text-white/20 group-hover:text-[#0A84FF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </div>
              </a>
            </div>
          </section>

          {/* Footer actions with horizontal layout */}
          <div className="pt-4 px-1 flex flex-col space-y-4">
            <div className="flex gap-2">
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="flex-[1.2] py-2.5 rounded-lg bg-[#0A84FF]/10 hover:bg-[#0A84FF]/20 border border-[#0A84FF]/20 hover:border-[#0A84FF]/40 transition-all active:scale-95 cursor-pointer group flex items-center justify-center gap-2 overflow-hidden"
              >
                {checkingUpdate ? (
                  <svg className="animate-spin h-3 w-3 text-[#0A84FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-[#0A84FF] group-hover:rotate-180 transition-transform duration-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                )}
                <span className="text-[10px] font-black text-[#0A84FF] uppercase tracking-widest whitespace-nowrap">
                  {checkingUpdate ? '检查中' : '检查更新'}
                </span>
              </button>

              <button
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  setTheme({
                    backgroundMode: 'liquid',
                    blob1Color: '#7000FF',
                    blob2Color: '#0070FF',
                    blob3Color: '#FF0060',
                    solidColor: '#0f0f13',
                    gradientStart: '#1a1a25',
                    gradientEnd: '#050505',
                    blurAmount: 60,
                  });
                  setConfirmReset(false);
                }}
                className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer border truncate
                ${confirmReset
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/20 hover:text-white/40 hover:bg-white/[0.05]'}`}
              >
                {confirmReset ? '确认重置' : '恢复出厂'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
