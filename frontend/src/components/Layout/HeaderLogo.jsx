import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu } from 'lucide-react';

export const HeaderLogo = React.memo(() => {
  return (
    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
      <div className="p-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
        <Cpu size={20} className="text-white" />
      </div>
      <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        AetherPC
      </span>
    </Link>
  );
});

HeaderLogo.displayName = 'HeaderLogo';

