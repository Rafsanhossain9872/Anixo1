import React, { useEffect, useRef } from 'react';

const ADSTERRA_SMART_LINK = "https://dependedunmoved.com/frn634x83?key=9a6dc4b3d875352a8a24a0f683ec35ae";

export function AdsterraSmartLinkBanner() {
  const containerRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    const container = containerRef.current;
    container.innerHTML = '';

    // Create a clickable banner
    const banner = document.createElement('a');
    banner.href = ADSTERRA_SMART_LINK;
    banner.target = "_blank";
    banner.rel = "noopener noreferrer";
    banner.className = "block w-full";
    banner.style.textDecoration = "none";

    const bannerContent = document.createElement('div');
    bannerContent.className = "w-full bg-gradient-to-r from-red-900/20 via-red-800/30 to-red-900/20 border border-red-600/30 rounded-lg p-4 text-center cursor-pointer hover:border-red-500/50 transition-all duration-300";
    
    const title = document.createElement('h3');
    title.className = "text-lg font-bold text-white mb-1";
    title.textContent = "🔥 Special Offer - Don't Miss Out! 🔥";
    
    const subtitle = document.createElement('p');
    subtitle.className = "text-sm text-white/70";
    subtitle.textContent = "Click here to explore amazing deals!";

    bannerContent.appendChild(title);
    bannerContent.appendChild(subtitle);
    banner.appendChild(bannerContent);
    container.appendChild(banner);

    return () => {
      loadedRef.current = false;
    };
  }, []);

  return (
    <div className="w-full flex justify-center py-4 overflow-hidden">
      <div ref={containerRef} className="w-full max-w-[1400px]" />
    </div>
  );
}

// Hook to open smart link programmatically (e.g., on episode change)
export function useAdsterraSmartLink() {
  const openSmartLink = () => {
    window.open(ADSTERRA_SMART_LINK, "_blank", "noopener,noreferrer");
  };

  return { openSmartLink };
}