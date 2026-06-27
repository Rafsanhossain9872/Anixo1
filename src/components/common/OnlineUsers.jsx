import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { User, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const OnlineUsers = () => {
  const [onlineStats, setOnlineStats] = useState({ total: 0, registered: 0, guests: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Connect to online server
    const socket = io(import.meta.env.VITE_ONLINE_SERVER_URL || 'http://localhost:7861');

    socket.on('connect', () => {
      setIsConnected(true);
      // Identify user type on connect
      socket.emit('identify-user', !!user);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('online-count', (stats) => {
      setOnlineStats(stats);
    });

    // Update user type when auth status changes
    if (socket.connected) {
      socket.emit('identify-user', !!user);
    }

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [user]);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      <Users size={14} className="text-white/70" />
      <span className="text-xs font-medium text-white/90">
        {onlineStats.total} Online
      </span>
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <User size={10} className="text-red-400" />
          <span className="text-white/70">{onlineStats.registered}</span>
        </div>
        <span className="text-white/30">|</span>
        <div className="flex items-center gap-1">
          <User size={10} className="text-white/40" />
          <span className="text-white/50">{onlineStats.guests}</span>
        </div>
      </div>
    </div>
  );
};

export default OnlineUsers;
