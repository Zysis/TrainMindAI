import { cn } from '../lib/utils';
import { getInitials, getAvatarColor } from '@trainmind/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({ firstName, lastName, photoUrl, size = 'md', className }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const bgColor = getAvatarColor(`${firstName} ${lastName}`);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-bold text-white',
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );
}
