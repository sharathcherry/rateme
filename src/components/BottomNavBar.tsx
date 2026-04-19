import { Link, useLocation } from 'react-router-dom';
import { Compass, Star, Bell, User } from 'lucide-react';
import { cn } from '../lib/utils';

export function BottomNavBar() {
  const location = useLocation();
  
  const navItems = [
    { icon: Compass, label: 'Explore', path: '/browse' },
    { icon: Star, label: 'Ratings', path: '/ratings' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex justify-around items-center px-2 py-3 bg-[#1C1C1E]/90 backdrop-blur-xl rounded-[32px] z-50 border border-white/[0.04]">
      {navItems.map((item, index) => {
        const isActive = location.pathname === item.path || (item.path === '/browse' && location.pathname === '/');
        return (
          <Link
            key={index}
            to={item.path}
            className="flex flex-col items-center justify-center gap-1 w-16 relative"
          >
            <item.icon 
              size={22} 
              strokeWidth={isActive ? 2.5 : 2} 
              className={isActive ? "text-[#FF4D6D]" : "text-[#8A8894] hover:text-[#D4D4D8] transition-colors"}
              fill={isActive && item.label === 'Ratings' ? "currentColor" : "none"} 
            />
            <span className={cn(
              "text-[10px] font-medium transition-colors",
              isActive ? "text-[#FF4D6D]" : "text-[#8A8894]"
            )}>
              {item.label}
            </span>
            {isActive && (
              <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-[#FF4D6D] shadow-[0_0_8px_rgba(255,77,109,0.8)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
