import React from 'react';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ visible, onClose }) => {
  return (
    <div 
      className={`fixed top-0 right-[-320px] w-[300px] h-screen bg-[rgba(30,30,35,0.7)] backdrop-blur-[40px] saturate-[180%] border-l border-[rgba(255,255,255,0.1)] shadow-[-10px_0_30px_rgba(0,0,0,0.3)] z-[1000] transition-transform duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] p-[24px] box-border text-white
        ${visible ? 'translate-x-[-320px]' : ''}`}
    >
      <div className="flex justify-between items-center mb-[30px]">
        <h3 className="m-0 text-[20px] font-semibold">设置</h3>
        <button className="bg-none border-none text-[28px] text-[rgba(255,255,255,0.5)] cursor-pointer leading-none hover:text-white" onClick={onClose}>&times;</button>
      </div>
      
      <div className="drawer-content">
        <div className="mb-[24px]">
          <label className="block text-[13px] text-[rgba(255,255,255,0.6)] mb-[8px] font-medium">画质选择</label>
          <select className="w-full bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.1)] rounded-[8px] color-white p-[8px_12px] outline-none" defaultValue="1080p">
            <option value="720p">720p (流畅)</option>
            <option value="1080p">1080p (高清)</option>
            <option value="orig">原始分辨率</option>
          </select>
        </div>

        <div className="mb-[24px]">
          <label className="block text-[13px] text-[rgba(255,255,255,0.6)] mb-[8px] font-medium">帧率限制</label>
          <div className="flex items-center gap-[12px] text-[12px]">
            <input className="flex-1 accent-[var(--accent)]" type="range" min="30" max="60" step="30" defaultValue="60" />
            <span>60 FPS</span>
          </div>
        </div>

        <div className="mb-[24px]">
            <label className="block text-[13px] text-[rgba(255,255,255,0.6)] mb-[8px] font-medium">连接方式</label>
            <div className="text-[13px] bg-[rgba(10,132,255,0.15)] text-[var(--accent)] p-[10px_14px] rounded-[10px] border border-[rgba(10,132,255,0.2)]">当前连接：USB (WDA)</div>
        </div>

        <div className="bg-[rgba(255,255,255,0.2)] h-[1px] my-[20px]"></div>

        <button className="w-full bg-[var(--accent)] border-none rounded-[10px] text-white p-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-90">检查更新</button>
      </div>
    </div>
  );
};

export default Settings;
