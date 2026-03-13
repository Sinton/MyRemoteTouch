import React from 'react';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ visible, onClose }) => {
  return (
    <div className={`settings-drawer ${visible ? 'open' : ''}`}>
      <div className="drawer-header">
        <h3>设置</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      
      <div className="drawer-content">
        <div className="setting-group">
          <label>画质选择</label>
          <select defaultValue="1080p">
            <option value="720p">720p (流畅)</option>
            <option value="1080p">1080p (高清)</option>
            <option value="orig">原始分辨率</option>
          </select>
        </div>

        <div className="setting-group">
          <label>帧率限制</label>
          <div className="range-container">
            <input type="range" min="30" max="60" step="30" defaultValue="60" />
            <span>60 FPS</span>
          </div>
        </div>

        <div className="setting-group">
            <label>连接方式</label>
            <div className="toggle-info">当前连接：USB (WDA)</div>
        </div>

        <div className="divider" style={{ margin: '20px 0' }}></div>

        <button className="primary-btn">检查更新</button>
      </div>
    </div>
  );
};

export default Settings;
