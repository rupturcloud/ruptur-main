import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Send, 
  Wallet, 
  MessageSquare, 
  LogOut,
  Zap
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={20} /> },
  { id: 'campaigns', label: 'Campanhas',  icon: <Send size={20} /> },
  { id: 'wallet',    label: 'Carteira',   icon: <Wallet size={20} /> },
  { id: 'inbox',     label: 'Inbox',      icon: <MessageSquare size={20} /> },
];

const Sidebar = ({ activeTab, setActiveTab, onLogout, tenantId }) => {
  return (
    <aside className="sidebar glass">
      {/* Logo */}
      <div className="logo-container">
        <div className="logo-icon-wrap">
          <Zap size={20} fill="currentColor" />
        </div>
        <div>
          <h2 className="logo-text">RUPTUR<span>CLOUD</span></h2>
          <p className="logo-sub">Automação WhatsApp</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.97 }}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
            {activeTab === item.id && (
              <motion.div
                layoutId="active-pill"
                className="active-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="sidebar-footer">
        {tenantId && (
          <div className="tenant-info">
            <div className="tenant-avatar">
              {tenantId.charAt(0).toUpperCase()}
            </div>
            <div className="tenant-text">
              <span className="tenant-name">{tenantId}</span>
              <span className="tenant-role">Cliente</span>
            </div>
          </div>
        )}
        <button className="nav-item logout" onClick={onLogout}>
          <span className="icon"><LogOut size={18} /></span>
          <span className="label">Sair</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          position: fixed;
          left: 0; top: 0;
          display: flex;
          flex-direction: column;
          padding: 28px 16px;
          border-right: 1px solid var(--border-glass);
          z-index: 100;
          background: rgba(8, 8, 14, 0.9);
        }

        /* Logo */
        .logo-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          padding: 0 8px;
        }
        .logo-icon-wrap {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
          box-shadow: 0 4px 16px var(--secondary-glow);
        }
        .logo-text {
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1;
          font-family: 'Outfit', sans-serif;
        }
        .logo-text span { color: var(--primary); }
        .logo-sub {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Nav */
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          text-align: left;
          width: 100%;
          position: relative;
          font-family: 'Inter', sans-serif;
        }

        .nav-item:hover {
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
        }

        .nav-item.active {
          color: var(--primary);
          background: rgba(0, 242, 255, 0.08);
          font-weight: 600;
        }

        .active-indicator {
          position: absolute;
          left: 0; top: 8px; bottom: 8px;
          width: 3px;
          border-radius: 2px;
          background: var(--primary);
          box-shadow: 0 0 10px var(--primary);
        }

        .nav-item .icon {
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .nav-item .label { font-size: 0.92rem; }

        /* Footer */
        .sidebar-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 20px;
          border-top: 1px solid var(--border-glass);
        }

        .tenant-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-glass);
          margin-bottom: 4px;
        }
        .tenant-avatar {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--secondary), var(--primary));
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.9rem; color: white;
          flex-shrink: 0;
        }
        .tenant-text { display: flex; flex-direction: column; min-width: 0; }
        .tenant-name {
          font-size: 0.82rem; font-weight: 600;
          color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tenant-role { font-size: 0.7rem; color: var(--text-muted); }

        .nav-item.logout { color: var(--text-muted); }
        .nav-item.logout:hover {
          color: var(--accent);
          background: rgba(255, 0, 122, 0.08);
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
