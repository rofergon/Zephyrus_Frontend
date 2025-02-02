import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  DocumentDuplicateIcon,
  CogIcon,
  UsersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  // Auto collapse sidebar when navigating to chat
  useEffect(() => {
    if (location.pathname === '/chat' && isOpen) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  const menuItems = [
    { path: '/dashboard', icon: HomeIcon, text: 'Dashboard' },
    { path: '/chat', icon: ChatBubbleLeftRightIcon, text: 'Solidity Assistant' },
    { path: '/templates', icon: DocumentDuplicateIcon, text: 'Contract Templates' },
    { path: '/deploy', icon: CogIcon, text: 'Deploy' },
    { path: '/admin', icon: WrenchScrewdriverIcon, text: 'Contract Admin' },
    { path: '/bonding-tokens', icon: CurrencyDollarIcon, text: 'Bonding Tokens' },
    { path: '/social', icon: UsersIcon, text: 'Social' },
  ];

  return (
    <>
      <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] glass-morphism border-r border-gray-700 transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-16'
      } ${location.pathname === '/chat' ? 'z-0' : 'z-50'}`}>
        <div className="h-full px-3 py-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`gradient-border flex items-center p-3 text-base font-medium rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-gray-300 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 transition-colors duration-200 ${
                      isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'
                    }`} />
                    {isOpen && <span className="ml-3">{item.text}</span>}
                    {isOpen && isActive && (
                      <div className="ml-auto w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
      {location.pathname !== '/chat' && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed left-0 bottom-4 w-8 h-8 bg-gray-800 text-gray-300 rounded-r-lg flex items-center justify-center hover:bg-gray-700 transition-all duration-200 z-50"
        >
          {isOpen ? (
            <ChevronLeftIcon className="w-5 h-5" />
          ) : (
            <ChevronRightIcon className="w-5 h-5" />
          )}
        </button>
      )}
    </>
  );
};

export default Sidebar;