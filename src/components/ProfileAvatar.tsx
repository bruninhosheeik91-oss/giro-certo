import React, { useEffect, useState } from 'react';

interface ProfileAvatarProps {
  name: string;
  photoUrl?: string;
  className: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ name, photoUrl, className }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'GC';

  return (
    <div
      role="img"
      aria-label={name}
      className={`${className} flex items-center justify-center bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-slate-950`}
    >
      {initials}
    </div>
  );
};
