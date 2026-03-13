import React from 'react';

interface SkeletonProps {
  message?: string;
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  message = "加密连接初始化...", 
  className = "" 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center bg-[#0f0f13] font-sans p-[10px] w-full h-full ${className}`}>
      <div className="flex flex-col-reverse items-center justify-center gap-[15px]">
        
        {/* Toolbar Placeholder */}
        <div className="w-[240px] h-[48px] bg-[#282828]/85 border border-white/10 rounded-xl flex items-center justify-evenly px-4">
          <div className="w-3 h-[18px] bg-white/10 rounded-sm"></div>
          <div className="w-6 h-6 bg-white/5 rounded-md"></div>
          <div className="w-6 h-6 bg-white/5 rounded-md"></div>
          <div className="w-6 h-6 bg-white/5 rounded-md"></div>
          <div className="w-[1px] h-4 bg-white/10"></div>
          <div className="w-6 h-6 bg-white/5 rounded-md"></div>
        </div>

        {/* Phone Screen Placeholder */}
        <div className="h-[91vh] aspect-[1170/2532] bg-[#1c1c1e] rounded-[48px] border-2 border-[#3a3a3c] shadow-2xl relative flex items-center justify-center overflow-hidden">
          {/* Notch */}
          <div className="w-[140px] h-7 bg-[#1c1c1e] absolute top-[10px] left-1/2 -translate-x-1/2 rounded-b-2xl border border-[#3a3a3c] border-t-0"></div>
          
          <div className="flex flex-col items-center gap-4">
            {/* Spinning Loader */}
            <div className="w-8 h-8 border-3 border-white/5 border-t-[#0A84FF] rounded-full animate-spin"></div>
            <span className="color-white/30 text-[13px] font-medium tracking-widest uppercase">{message}</span>
          </div>

          {/* Subtle shine animation overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
