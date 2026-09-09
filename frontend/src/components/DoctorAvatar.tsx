import React, { useState } from 'react';
import { getDoctorInitials, getDoctorPhotoUrl } from '../features/doctors/utils/chamberUtils';

interface DoctorAvatarProps {
  name: string;
  profilePhotoUrl?: string | null;
  sizeClass?: string;
}

const AVATAR_GRADIENTS = [
  'from-teal-600 to-blue-700',
  'from-blue-700 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-cyan-600 to-blue-700',
];

const gradientForName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

export const DoctorAvatar: React.FC<DoctorAvatarProps> = ({
  name,
  profilePhotoUrl,
  sizeClass = 'w-16 h-16 text-xl',
}) => {
  const resolved = getDoctorPhotoUrl(profilePhotoUrl);
  const [failed, setFailed] = useState(false);
  const showImage = resolved && !failed;

  if (showImage) {
    return (
      <img
        src={resolved}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-2xl object-cover border border-teal-100 shadow-inner bg-teal-50 shrink-0`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      title={name}
      className={`${sizeClass} rounded-2xl bg-gradient-to-br ${gradientForName(name)} text-white flex items-center justify-center font-extrabold tracking-wide border border-white/20 shadow-inner shrink-0`}
    >
      {getDoctorInitials(name)}
    </div>
  );
};
